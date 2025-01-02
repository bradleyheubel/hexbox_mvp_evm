// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract USDCFundraiser is Ownable, Pausable, ReentrancyGuard {
    IERC20 public usdc;
    address public beneficiaryWallet;
    address public feeWallet;
    uint256 public minimumTarget;
    uint256 public deadline;
    bool public enforceConditions;
    uint256 public feePercentage; // Stored as basis points (e.g., 250 = 2.5%)
    
    mapping(address => uint256) public deposits;
    uint256 public totalRaised;
    bool public finalized;

    event Deposit(address indexed depositor, uint256 amount, uint256 fee);
    event Refund(address indexed depositor, uint256 amount);
    event FundsReleased(address indexed beneficiary, uint256 amount);
    event FeeUpdated(uint256 newFeePercentage);
    event EmergencyWithdraw(address indexed to, uint256 amount);

    constructor(
        address _usdcAddress,
        address _beneficiaryWallet,
        address _feeWallet,
        uint256 _minimumTarget,
        uint256 _deadline,
        bool _enforceConditions
    ) Ownable(msg.sender) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_beneficiaryWallet != address(0), "Invalid beneficiary wallet");
        require(_feeWallet != address(0), "Invalid fee wallet");
        
        usdc = IERC20(_usdcAddress);
        beneficiaryWallet = _beneficiaryWallet;
        feeWallet = _feeWallet;
        minimumTarget = _minimumTarget;
        deadline = _deadline;
        enforceConditions = _enforceConditions;
        feePercentage = 250; // 2.5% default fee
    }

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(!finalized, "Fundraiser is finalized");
        if (enforceConditions) {
            require(block.timestamp <= deadline, "Deadline has passed");
        }

        uint256 fee = (amount * feePercentage) / 10000;
        uint256 netAmount = amount - fee;

        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        if (fee > 0) {
            require(usdc.transfer(feeWallet, fee), "Fee transfer failed");
        }

        deposits[msg.sender] += netAmount;
        totalRaised += netAmount;

        emit Deposit(msg.sender, amount, fee);
    }

    function finalize() external nonReentrant whenNotPaused {
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
} 