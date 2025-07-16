# Proxy Upgrade Implementation Guide

This guide explains how to deploy and upgrade your fundraiser contracts using proxy patterns for upgradeability.

## Overview

Your contracts have been converted to use two different proxy patterns:

1. **USDCFundraiserFactory** → **USDCFundraiserFactoryUpgradeable** (UUPS Proxy)
2. **USDCFundraiser** → **USDCFundraiserUpgradeable** (Minimal Proxy/Clone pattern)

## Architecture

### Factory Contract (UUPS Proxy)
- The factory itself is deployed as a UUPS upgradeable proxy
- You can upgrade the factory logic while preserving state
- Single deployment, single proxy address

### Fundraiser Contracts (Minimal Proxy Pattern)
- The factory deploys minimal proxy clones of a master implementation
- Each fundraiser is a lightweight proxy pointing to the implementation
- Gas-efficient deployment of multiple instances
- You can upgrade the implementation for new fundraisers

## Key Changes Made

### 1. USDCFundraiserFactoryUpgradeable.sol
- ✅ Inherits from `Initializable`, `OwnableUpgradeable`, `UUPSUpgradeable`
- ✅ Constructor replaced with `initialize()` function
- ✅ Uses `Clones.clone()` to deploy fundraiser proxies
- ✅ Added `updateFundraiserImplementation()` for upgrading implementation
- ✅ Added tracking of deployed fundraisers
- ✅ Authorization check in `_authorizeUpgrade()`

### 2. USDCFundraiserUpgradeable.sol
- ✅ Inherits from upgradeable OpenZeppelin contracts
- ✅ Constructor replaced with `initialize()` function
- ✅ Disabled initializers in constructor
- ✅ All original functionality preserved
- ✅ Additional view functions for better state management

## Deployment Process

### Prerequisites
Make sure you have these dependencies in your `package.json`:
```json
{
  "@openzeppelin/contracts": "^5.0.0",
  "@openzeppelin/contracts-upgradeable": "^5.0.0",
  "@openzeppelin/hardhat-upgrades": "^3.0.0"
}
```

### Step 1: Deploy Initial Contracts
```bash
# Update the configuration in scripts/deploy-upgradeable.js
# Set your USDC address, ProductToken address, fee wallet, etc.

npx hardhat run scripts/deploy-upgradeable.js --network <your-network>
```

This will:
- Deploy USDCFundraiserUpgradeable implementation
- Deploy USDCFundraiserFactoryUpgradeable with UUPS proxy
- Save deployment addresses to `deployment-info.json`

### Step 2: Verify Contracts
```bash
# Commands will be provided in the deployment output
npx hardhat verify --network <network> <implementation-address>
npx hardhat verify --network <network> <factory-implementation-address>
```

## Upgrade Process

### Upgrading the Factory
```bash
npx hardhat run scripts/upgrade-factory.js --network <your-network>
```

### Upgrading the Fundraiser Implementation
```bash
npx hardhat run scripts/upgrade-fundraiser-implementation.js --network <your-network>
```

## Usage Examples

### Creating a Fundraiser (Same as before)
```javascript
const factory = await ethers.getContractAt("USDCFundraiserFactoryUpgradeable", FACTORY_PROXY_ADDRESS);

const products = [
    { productId: 1, price: ethers.parseUnits("100", 6), supplyLimit: 1000 }
];

const tx = await factory.createFundraiser(
    beneficiaryWallet,
    0, // fundingType
    ethers.parseUnits("10000", 6), // minimumTarget
    Math.floor(Date.now() / 1000) + 86400 * 30, // deadline (30 days)
    products
);

const receipt = await tx.wait();
// Extract fundraiser address from events
```

### Interacting with a Fundraiser
```javascript
const fundraiser = await ethers.getContractAt("USDCFundraiserUpgradeable", FUNDRAISER_ADDRESS);

// Same interface as before
await fundraiser.deposit(productId, quantity);
await fundraiser.finalize();
// etc.
```

## Important Considerations

### State Variables
- ⚠️ When upgrading implementations, be careful about state variable ordering
- ⚠️ Never remove or change the type of existing state variables
- ✅ Only add new state variables at the end

### Storage Slots
- The factory uses OpenZeppelin's storage slots pattern
- Each proxy maintains its own storage
- Implementation contracts should not have constructor logic

### Upgrading Existing Fundraisers
- 🔄 The factory upgrade affects new fundraiser deployments
- 🔄 Existing fundraiser proxies continue using their original implementation
- 🔄 To upgrade existing fundraisers, you'd need a migration mechanism

### Security
- 🔒 Only the factory owner can upgrade the factory
- 🔒 Only the factory owner can update the fundraiser implementation
- 🔒 Each fundraiser has its own owner (transferred from factory owner)

## Gas Considerations

### Deployment Costs
- Factory: Higher initial cost due to proxy setup
- Fundraisers: ~90% gas savings per deployment (minimal proxy)

### Upgrade Costs
- Factory upgrades: Standard proxy upgrade cost
- Implementation updates: Single transaction affects all new deployments

## Testing Upgradability

### Test Upgrade Compatibility
```bash
# After making changes to your contracts
npx hardhat test test/upgrade-tests.js
```

### Validate Storage Layout
```bash
npx @openzeppelin/upgrades-core validate-storage-layout <contract-name>
```

## Troubleshooting

### Common Issues
1. **"Contract already initialized"** - Make sure you're calling `initialize()` only once
2. **"Function selector not recognized"** - Verify proxy is pointing to correct implementation
3. **"Storage collision"** - Check state variable ordering in upgrades

### Debug Commands
```javascript
// Get current implementation
const impl = await upgrades.erc1967.getImplementationAddress(proxyAddress);

// Get admin address
const admin = await upgrades.erc1967.getAdminAddress(proxyAddress);
```

## Migration from Original Contracts

If you have existing non-upgradeable contracts deployed:

1. Deploy the new upgradeable versions
2. Update your frontend/scripts to use new addresses
3. Optionally migrate data from old contracts
4. Consider a gradual migration strategy

## Security Auditing

Before upgrading contracts in production:
- ✅ Test upgrades on testnet
- ✅ Audit new implementation code
- ✅ Verify storage layout compatibility
- ✅ Test all existing functionality still works
- ✅ Have an emergency pause/upgrade plan

## Support

For questions about proxy patterns and upgrades:
- [OpenZeppelin Upgrades Documentation](https://docs.openzeppelin.com/upgrades-plugins/1.x/)
- [OpenZeppelin Proxy Patterns](https://blog.openzeppelin.com/proxy-patterns)
