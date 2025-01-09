// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "./ProductToken.sol";

contract USDCFundraiser is Ownable, Pausable, ReentrancyGuard, AutomationCompatibleInterface {
    IERC20 public usdc;
    ProductToken public productToken;
    address public beneficiaryWallet;
    address public feeWallet;
    uint256 public minimumTarget;
    uint256 public deadline;
    bool public enforceConditions;
    uint256 public feePercentage; // Stored as basis points (e.g., 250 = 2.5%)
    
    mapping(address => uint256) public deposits;
    uint256 public totalRaised;
    bool public finalized;
    uint256 private currentTokenId;
    mapping(uint256 => uint256) public tokenDeposits; // tokenId => deposit amount
    mapping(uint256 => uint256) public productPrices;

    event Deposit(address indexed depositor, uint256 amount, uint256 fee);
    event Refund(address indexed depositor, uint256 amount);
    event FundsReleased(address indexed beneficiary, uint256 amount);
    event FeeUpdated(uint256 newFeePercentage);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event ProductPriceSet(uint256 productId, uint256 price);

    constructor(
        address _usdcAddress,
        address _beneficiaryWallet,
        address _feeWallet,
        uint256 _minimumTarget,
        uint256 _deadline,
        bool _enforceConditions,
        address _productTokenAddress,
        uint256[] memory _productIds,
        uint256[] memory _productPrices
    ) Ownable(msg.sender) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_beneficiaryWallet != address(0), "Invalid beneficiary wallet");
        require(_feeWallet != address(0), "Invalid fee wallet");
        require(_productIds.length == _productPrices.length, "Arrays length mismatch");
        require(_productIds.length > 0, "No products provided");
        
        usdc = IERC20(_usdcAddress);
        beneficiaryWallet = _beneficiaryWallet;
        feeWallet = _feeWallet;
        minimumTarget = _minimumTarget;
        deadline = _deadline;
        enforceConditions = _enforceConditions;
        feePercentage = 250; // 2.5% default fee
        productToken = ProductToken(_productTokenAddress);

        // Set initial product prices
        for(uint256 i = 0; i < _productIds.length; i++) {
            require(_productPrices[i] > 0, "Invalid product price");
            productPrices[_productIds[i]] = _productPrices[i];
            emit ProductPriceSet(_productIds[i], _productPrices[i]);
        }
    }

    function deposit(uint256 productId, uint256 quantity) external nonReentrant whenNotPaused {
        require(quantity > 0, "Quantity must be greater than 0");
        require(!finalized, "Fundraiser is finalized");
        require(productPrices[productId] > 0, "Product not available");
        
        if (enforceConditions) {
            require(block.timestamp <= deadline, "Deadline has passed");
        }

        uint256 totalAmount = productPrices[productId] * quantity;
        uint256 fee = (totalAmount * feePercentage) / 10000;
        uint256 netAmount = totalAmount - fee;

        require(usdc.transferFrom(msg.sender, address(this), totalAmount), "Transfer failed");
        
        if (fee > 0) {
            require(usdc.transfer(feeWallet, fee), "Fee transfer failed");
        }

        // Mint NFTs to depositor
        productToken.mint(msg.sender, productId, quantity);
        
        // Store deposit amount against token ID
        tokenDeposits[productId] += netAmount;
        totalRaised += netAmount;

        emit Deposit(msg.sender, totalAmount, fee);
    }

    function finalize() public nonReentrant whenNotPaused {
        require(!finalized, "Already finalized");
        
        if (enforceConditions) {
            require(block.timestamp > deadline, "Deadline not reached");
            
            if (totalRaised >= minimumTarget) {
                _releaseFunds();
            } else {
                _processRefunds();
            }
        } else {
            _releaseFunds();
        }
        
        finalized = true;
    }

    function _releaseFunds() private {
        require(usdc.transfer(beneficiaryWallet, totalRaised), "Transfer failed");
        emit FundsReleased(beneficiaryWallet, totalRaised);
    }

    function _processRefunds() private {
        for (address depositor = address(0); deposits[depositor] > 0;) {
            uint256 amount = deposits[depositor];
            deposits[depositor] = 0;
            require(usdc.transfer(depositor, amount), "Refund failed");
            emit Refund(depositor, amount);
        }
    }

    // Admin functions
    function updateFeePercentage(uint256 newFeePercentage) external onlyOwner {
        require(newFeePercentage <= 1000, "Fee cannot exceed 10%");
        feePercentage = newFeePercentage;
        emit FeeUpdated(newFeePercentage);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount <= usdc.balanceOf(address(this)), "Insufficient balance");
        require(usdc.transfer(to, amount), "Transfer failed");
        emit EmergencyWithdraw(to, amount);
    }

    // Only for testing
    function updateDeadline(uint256 newDeadline) external onlyOwner {
        require(!finalized, "Fundraiser is finalized");
        require(newDeadline > block.timestamp, "Deadline must be in the future");
        deadline = newDeadline;
    }

    function setProductPrice(uint256 productId, uint256 price) external onlyOwner {
        productPrices[productId] = price;
        emit ProductPriceSet(productId, price);
    }

    function claimRefund(uint256 productId) external {
        require(finalized, "Not finalized");
        require(totalRaised < minimumTarget, "Target was met");
        
        uint256 balance = productToken.balanceOf(msg.sender, productId);
        require(balance > 0, "No tokens to refund");
        
        uint256 refundAmount = (tokenDeposits[productId] * balance) / productToken.productSupply(productId);
        tokenDeposits[productId] = tokenDeposits[productId] - refundAmount;
        
        // Burn the NFTs first
        productToken.burn(msg.sender, productId, balance);
        
        // Then send the refund
        require(usdc.transfer(msg.sender, refundAmount), "Refund failed");
        emit Refund(msg.sender, refundAmount);
    }

    // Add checkUpkeep function
    function checkUpkeep(bytes calldata /* checkData */) 
        external 
        view 
        override 
        returns (bool upkeepNeeded, bytes memory /* performData */) 
    {
        upkeepNeeded = !finalized && block.timestamp > deadline;
        return (upkeepNeeded, "");
    }

    // Add performUpkeep function
    function performUpkeep(bytes calldata /* performData */) external override {
        if (!finalized && block.timestamp > deadline) {
            finalize();
        }
    }
} 