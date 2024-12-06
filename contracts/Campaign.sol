// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ProjectToken.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FundraisingCampaign is ReentrancyGuard {
    struct Campaign {
        uint256 targetAmount;
        uint256 totalTokens;
        uint256 tokenPrice;
        uint256 raisedAmount;
        bool isActive;
        address projectCreator;
    }

    struct Proposal {
        uint256 id;
        address payable recipient;
        uint256 amount;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        bool active;
        mapping(address => bool) hasVoted;
    }

    Campaign public campaign;
    ProjectToken public governanceToken;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    IERC20 public immutable usdc;

    event ProposalCreated(uint256 indexed proposalId, address recipient, uint256 amount);
    event Voted(uint256 indexed proposalId, address voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId);
    event Investment(address investor, uint256 amount, uint256 tokens);

    constructor(
        uint256 _targetAmount,
        uint256 _totalTokens,
        string memory tokenName,
        string memory tokenSymbol,
        address _usdcAddress
    ) {
        require(_targetAmount > 0, "Target amount must be greater than 0");
        require(_totalTokens > 0, "Total tokens must be greater than 0");
        require(_usdcAddress != address(0), "Invalid USDC address");

        usdc = IERC20(_usdcAddress);
        
        campaign = Campaign({
            targetAmount: _targetAmount,
            totalTokens: _totalTokens,
            tokenPrice: _targetAmount / _totalTokens,
            raisedAmount: 0,
            isActive: true,
            projectCreator: msg.sender
        });

        governanceToken = new ProjectToken(
            tokenName,
            tokenSymbol,
            _totalTokens,
            address(this)
        );
    }

    function invest(uint256 amount) external nonReentrant {
        require(campaign.isActive, "Campaign is not active");
        require(amount > 0, "Investment amount must be greater than 0");
        require(campaign.raisedAmount + amount <= campaign.targetAmount, "Exceeds target amount");

        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");

        uint256 tokenAmount = (amount * campaign.totalTokens) / campaign.targetAmount;
        campaign.raisedAmount += amount;

        governanceToken.mint(msg.sender, tokenAmount);

        emit Investment(msg.sender, amount, tokenAmount);

        if (campaign.raisedAmount >= campaign.targetAmount) {
            campaign.isActive = false;
        }
    }

    function createProposal(address payable recipient, uint256 amount) external {
        require(governanceToken.balanceOf(msg.sender) > 0, "Must have governance tokens to create proposal");
        require(amount <= usdc.balanceOf(address(this)), "Insufficient contract balance");

        proposalCount++;
        Proposal storage proposal = proposals[proposalCount];
        proposal.id = proposalCount;
        proposal.recipient = recipient;
        proposal.amount = amount;
        proposal.active = true;

        emit ProposalCreated(proposalCount, recipient, amount);
    }

    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.active, "Proposal is not active");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        uint256 voterPower = governanceToken.balanceOf(msg.sender);
        require(voterPower > 0, "No voting power");

        proposal.hasVoted[msg.sender] = true;
        
        if (support) {
            proposal.yesVotes += voterPower;
        } else {
            proposal.noVotes += voterPower;
        }

        emit Voted(proposalId, msg.sender, support);

        // Check if proposal can be executed
        if (canExecute(proposalId)) {
            executeProposal(proposalId);
        }
    }

    function canExecute(uint256 proposalId) public view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        uint256 totalVotes = proposal.yesVotes + proposal.noVotes;
        
        if (totalVotes == 0) return false;
        
        uint256 yesPercentage = (proposal.yesVotes * 100) / totalVotes;
        return yesPercentage >= 70;
    }

    function executeProposal(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Proposal already executed");
        require(proposal.active, "Proposal not active");
        require(canExecute(proposalId), "Proposal cannot be executed");

        proposal.executed = true;
        proposal.active = false;

        require(usdc.transfer(proposal.recipient, proposal.amount), "USDC transfer failed");

        emit ProposalExecuted(proposalId);
    }
}