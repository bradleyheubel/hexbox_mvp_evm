// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "./ProductTokenUpgradeable.sol";

struct ProductConfig {
    uint256 productId;
    uint256 price;
    uint256 supplyLimit;  // 0 means unlimited supply
}

// Interface for factory minting/burning
interface IFactory {
    function mintForFundraiser(address productTokenAddress, address to, uint256 productId, uint256 amount) external;
    function burnForFundraiser(address productTokenAddress, address from, uint256 productId, uint256 amount) external;
}

contract USDCFundraiserUpgradeableV09102025 is Initializable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    
    uint256 public constant BASIS_POINTS = 10000; // 100% = 10000 basis points
    IERC20 public usdc;
    ProductTokenUpgradeable public productToken;
    address public factory;  // Factory address for minting/burning
    address public beneficiaryWallet;
    address public feeWallet;
    uint256 public minimumTarget;
    uint256 public deadline;
    uint256 public feePercentage; // Stored as basis points (e.g., 250 = 2.5%)
    
    uint256 public totalRaised;
    bool public finalized;
    mapping(uint256 => uint256) public tokenDeposits; // tokenId => deposit amount
    uint256[] public productIds;
    mapping(uint256 => uint256) public productSoldCount;    // productId => current sold count

    uint256 public fundingType; // 0 = all or nothing, 1 = limitless, 2 = flexible
    mapping(uint256 => ProductConfig) public products;
    address public campaignAdmin;

    modifier onlyAdminOrOwner() {
        require(msg.sender == owner() || msg.sender == campaignAdmin, "Not authorized");
        _;
    }

    struct RegistrationParams {
        string name;
        bytes encryptedEmail;
        address upkeepContract;
        uint32 gasLimit;
        address adminAddress;
        uint8 triggerType;
        bytes checkData;
        bytes triggerConfig;
        bytes offchainConfig;
        uint96 amount;
    }

    event Deposit(address indexed depositor, uint256 netAmount, uint256 feeAmount);
    event Finalized(bool success, uint256 totalRaised);
    event Refund(address indexed depositor, uint256 amount, uint256 productId, uint256 quantity);
    event ProductAdded(uint256 indexed productId, uint256 price, uint256 supplyLimit);
    event ProductUpdated(uint256 indexed productId, uint256 newPrice, uint256 newSupplyLimit);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _usdcAddress,
        address _beneficiaryWallet,
        address _feeWallet,
        uint256 _feePercentage,
        uint256 _fundingType,
        uint256 _minimumTarget,
        uint256 _deadline,
        address _productTokenAddress,
        address _factoryAddress,
        ProductConfig[] memory _products,
        address _campaignAdmin,
        address _owner
    ) public initializer {
        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();
        
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_beneficiaryWallet != address(0), "Invalid beneficiary wallet");
        require(_feeWallet != address(0), "Invalid fee wallet");
        require(_productTokenAddress != address(0), "Invalid product token address");
        require(_factoryAddress != address(0), "Invalid factory address");
        require(_deadline > block.timestamp, "Invalid deadline");
        require(_products.length > 0, "No products provided");
        require(_campaignAdmin != address(0), "Invalid campaign admin");
        require(_owner != address(0), "Invalid owner");
        require(_feePercentage < BASIS_POINTS, "Fee percentage must be less than 100%");

        usdc = IERC20(_usdcAddress);
        beneficiaryWallet = _beneficiaryWallet;
        feeWallet = _feeWallet;
        feePercentage = _feePercentage;
        minimumTarget = _minimumTarget;
        deadline = _deadline;
        productToken = ProductTokenUpgradeable(_productTokenAddress);
        factory = _factoryAddress;
        campaignAdmin = _campaignAdmin;
        fundingType = _fundingType;

        for (uint256 i = 0; i < _products.length; i++) {
            require(_products[i].price > 0, "Invalid product price");
            require(_products[i].productId > 0, "Invalid product ID");
            products[_products[i].productId] = _products[i];
            productIds.push(_products[i].productId);
        }
    }

    function deposit(uint256 productId, uint256 quantity) external nonReentrant whenNotPaused {
        ProductConfig memory product = products[productId];
        require(finalized == false, "Campaign is finalized");
        if (fundingType != 1) {
            require(block.timestamp < deadline, "Campaign has ended");
        }
        require(product.price > 0, "Invalid product");
        require(quantity > 0, "Invalid quantity");
        
        // Check supply limit
        if (product.supplyLimit > 0) {
            require(productSoldCount[productId] + quantity <= product.supplyLimit, "Exceeds supply limit");
        }

        uint256 totalAmount = product.price * quantity;
        uint256 feeAmount = (totalAmount * feePercentage) / BASIS_POINTS;
        uint256 netAmount = totalAmount - feeAmount;

        // Transfer USDC from user to contract
        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Mint NFT via factory (instead of calling productToken directly)
        // Only proceed with fees and tracking if mint succeeds
        try IFactory(factory).mintForFundraiser(address(productToken), msg.sender, productId, quantity) {
            // Mint successful - now safe to update tracking and pay fees
            
            // Update counts and totals
            productSoldCount[productId] += quantity;
            totalRaised += netAmount; // Only count net amount toward target
            
            // Pay fee wallet immediately after successful mint
            if (feeAmount > 0) {
                usdc.safeTransfer(feeWallet, feeAmount);
            }
            
            emit Deposit(msg.sender, netAmount, feeAmount);
        } catch Error(string memory reason) {
            // Mint failed - refund full amount to user (no fees deducted)
            usdc.safeTransfer(msg.sender, totalAmount);
            revert(string.concat("NFT mint failed: ", reason));
        } catch (bytes memory /*lowLevelData*/) {
            // Handle low-level errors - refund full amount
            usdc.safeTransfer(msg.sender, totalAmount);
            revert("NFT mint failed with low-level error");
        }
    }

    function finalize() public nonReentrant whenNotPaused {
        require(!finalized, "Already finalized");
        
        if (fundingType == 0) {
            // All or Nothing
            if (totalRaised >= minimumTarget) {
                // Target met - can finalize immediately, no need to wait for deadline
                _executeFinalization(true);
            } else {
                // Target not met - must wait for deadline
                require(block.timestamp > deadline, "Deadline not reached");

                // target not met and deadline passed - can finalize
                _executeFinalization(false);

            }
        } else if (fundingType == 1) {
            // Limitless - only admin/owner can finalize anytime
            require(msg.sender == owner() || msg.sender == campaignAdmin, "Not authorized");
            _executeFinalization(true);
        } else if (fundingType == 2) {
            // Flexible
            if (totalRaised >= minimumTarget) {
                // Target met - can finalize immediately, no need to wait for deadline
                _executeFinalization(true);
            } else {
                // Target not met - must wait for deadline
                require(block.timestamp > deadline, "Deadline not reached");
                _executeFinalization(true);
            }
        }
    }

    function _executeFinalization(bool releaseFunds) private {
        finalized = true;
        
        if (releaseFunds) {
            // Fees already paid on each deposit, so just transfer remaining balance to beneficiary
            uint256 contractBalance = usdc.balanceOf(address(this));
            
            if (contractBalance > 0) {
                usdc.safeTransfer(beneficiaryWallet, contractBalance);
            }
        }
        
        emit Finalized(releaseFunds, totalRaised);
    }

    function claimRefund(uint256 productId, uint256 quantity) external nonReentrant whenNotPaused {
        ProductConfig memory product = products[productId];
        require(product.price > 0, "Invalid product");
        
        // Funding Type 0: All or Nothing
        if (fundingType == 0) {
            // If target met (100% or more), no refunds allowed
            require(totalRaised < minimumTarget, "Target met - refunds not available");
        } 
        // Funding Type 1: Limitless
        else if (fundingType == 1) {
            // If not finalized: refunds allowed
            // If finalized: refunds not allowed
            require(finalized == false, "Campaign finalized - refunds not available");
        } 
        // Funding Type 2: Flexible
        else if (fundingType == 2) {
            // Before deadline: refunds allowed
            // After deadline: refunds not allowed
            require(block.timestamp < deadline, "Deadline passed - refunds not available");
            require(totalRaised < minimumTarget, "Target met - refunds not available")
        } else {
            revert("Invalid funding type");
        }

        // Burn the NFTs to get refund (via factory)
        uint256 balance = productToken.balanceOf(msg.sender, productId);
        require(balance >= quantity, "Insufficient NFT balance");
        
        IFactory(factory).burnForFundraiser(address(productToken), msg.sender, productId, quantity);
        
        uint256 fee = (product.price * feePercentage) / BASIS_POINTS;
        uint256 refundAmount = (product.price - fee) * quantity;
        usdc.safeTransfer(msg.sender, refundAmount);
        
        productSoldCount[productId] -= quantity;
        totalRaised -= refundAmount;

        emit Refund(msg.sender, refundAmount, productId, quantity);
    }

    function addProduct(ProductConfig memory product) external onlyAdminOrOwner {
        require(product.price > 0, "Invalid price");
        require(product.productId > 0, "Invalid product ID");
        require(products[product.productId].price == 0, "Product already exists");

        products[product.productId] = product;
        productIds.push(product.productId);
        
        emit ProductAdded(product.productId, product.price, product.supplyLimit);
    }

    function updateProduct(uint256 productId, uint256 newPrice, uint256 newSupplyLimit) external onlyAdminOrOwner {
        require(products[productId].price > 0, "Product does not exist");
        require(newPrice > 0, "Invalid price");
        
        if (newSupplyLimit > 0) {
            require(newSupplyLimit >= productSoldCount[productId], "Supply limit cannot be less than sold count");
        }

        products[productId].price = newPrice;
        products[productId].supplyLimit = newSupplyLimit;
        
        emit ProductUpdated(productId, newPrice, newSupplyLimit);
    }

    function pause() external onlyAdminOrOwner {
        _pause();
    }

    function unpause() external onlyAdminOrOwner {
        _unpause();
    }

    function getProductIds() external view returns (uint256[] memory) {
        return productIds;
    }

    function getProduct(uint256 productId) external view returns (ProductConfig memory) {
        return products[productId];
    }
}
