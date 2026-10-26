# Blockchain-Based Carbon Credit Tracking and Retirement

A student project prototype based on the supplied use-case report. It includes a Solidity registry and a wallet-connected browser interface for issuing, viewing, transferring, and retiring carbon-credit records.

## Features

- Admin-managed issuer allowlist; the deployer is the initial administrator and issuer.
- Issuers register unique credit batch IDs with a project name, quantity, initial owner, and optional document CID/hash.
- Owners transfer an entire batch and the contract appends each new owner to its history.
- Owners permanently retire their batch with a stated purpose and timestamp; retired batches cannot be transferred or retired twice.
- Public record lookup and ownership verification.
- MetaMask connection and web interface to browse records and submit transactions.

## Important project model

This prototype follows the report's batch-record model: each registration is one indivisible record. The quantity is stored as metadata, and a transfer moves the whole batch. It is not a fractional ERC-20/1155 token. Splitting quantities between owners would require a tokenized balance model and additional accounting.

The chain preserves the data submitted to it; it cannot prove that a project reduced emissions or that a certificate is genuine. Issuer vetting and environmental verification remain external responsibilities. Do not store private or personal data on-chain. A CID/hash is only an evidence reference, not an authenticity guarantee.

## Requirements

- Node.js 22.13+ and npm
- MetaMask browser extension
- Remix IDE (online) or another Solidity 0.8.24-compatible compiler for deployment

## Run the web app

```bash
npm install
npm install
npm run chain
```

Keep the blockchain command running. In a second terminal, run `npm run dev` and open the local URL shown by Vite. In MetaMask, add a local network with RPC `http://127.0.0.1:8545` and chain ID `31337`; import one of the **test-only** accounts and private keys printed by Hardhat. In Remix, select **Injected Provider - MetaMask** and deploy to that local network. Then open **Contract connection settings** in the web app, enter the deployed contract address and chain ID `31337`, save, and connect the wallet. Hardhat development accounts are public test keys and must never be used for real assets.

## Compile and deploy with Remix

1. Open [Remix](https://remix.ethereum.org/) and create `CarbonCreditRegistry.sol`.
2. Copy `contracts/CarbonCreditRegistry.sol` into the editor.
3. In **Solidity Compiler**, select compiler `0.8.24` or a compatible `0.8.x` version, compile, and review any warnings.
4. In **Deploy & Run**, choose **Injected Provider - MetaMask** and connect to a local chain or a test network such as Sepolia. Deploy `CarbonCreditRegistry` and confirm the transaction in MetaMask.
5. Copy the deployed contract address. In the web app's connection settings, set the address and the exact chain ID, then save and connect.
6. The deploying wallet is admin and an authorized issuer. To authorize another issuer, call `setIssuer(address, true)` from the admin wallet in Remix. To remove an issuer, call `setIssuer(address, false)`.
7. Register a test credit, then switch to its owner wallet to verify, transfer, or retire it.

Never use a wallet holding real funds for a classroom demo. Deploy to a local chain or test network first. Deployment and wallet transactions may require test-network gas.

## Repository layout

```text
contracts/CarbonCreditRegistry.sol  Smart contract
hardhat.config.ts                  Solidity compiler and local chain settings
src/main.js                         Wallet connection and application UI
src/abi.json                        Contract interface used by the browser app
src/style.css                       Responsive interface styles
index.html                          App entry point
package.json                        npm scripts and dependencies
```

## Project limitations

- This prototype has one administrator and a simple issuer allowlist; it is not a production governance model.
- A single record cannot be divided. The UI currently exposes issuance to the connected admin account; other authorized issuers may still issue by calling the contract directly.
- The browser app reads all records sequentially and is intended for small demos. A larger registry needs an event indexer or pagination.
- The document CID/hash is stored as provided. The app does not upload files to IPFS or calculate hashes.
- Public-chain addresses and transaction histories are visible. Avoid putting sensitive information in project names, purposes, or document references.
- Blockchain retirement prevents reuse inside this contract only. It does not synchronize with other registries or establish legal recognition of an offset.

## License

MIT. See [LICENSE](LICENSE).
