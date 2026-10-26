// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CarbonCreditRegistry
/// @notice Prototype registry for indivisible batches of carbon credits.
/// It records supplied evidence references; it does not verify carbon claims.
contract CarbonCreditRegistry {
    address public admin;
    uint256 public nextCreditId = 1;

    struct CarbonCredit {
        uint256 id;
        string projectName;
        address issuer;
        address owner;
        uint256 quantity;
        uint256 registeredAt;
        uint256 retiredAt;
        bool retired;
        string documentHash;
        string retirementPurpose;
    }

    mapping(uint256 => CarbonCredit) public credits;
    mapping(address => bool) public authorizedIssuers;
    mapping(uint256 => address[]) private ownershipHistory;

    event IssuerAuthorizationChanged(address indexed issuer, bool authorized);
    event CreditRegistered(uint256 indexed creditId, address indexed issuer, address indexed owner, uint256 quantity, string projectName, string documentHash);
    event CreditTransferred(uint256 indexed creditId, address indexed from, address indexed to);
    event CreditRetired(uint256 indexed creditId, address indexed owner, uint256 quantity, string purpose, uint256 retiredAt);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin only");
        _;
    }

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Issuer not authorized");
        _;
    }

    constructor() {
        admin = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerAuthorizationChanged(msg.sender, true);
    }

    function setIssuer(address issuer, bool authorized) external onlyAdmin {
        require(issuer != address(0), "Invalid issuer");
        require(issuer != admin || authorized, "Admin must remain issuer");
        authorizedIssuers[issuer] = authorized;
        emit IssuerAuthorizationChanged(issuer, authorized);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        address previousAdmin = admin;
        admin = newAdmin;
        authorizedIssuers[newAdmin] = true;
        emit IssuerAuthorizationChanged(newAdmin, true);
        emit AdminTransferred(previousAdmin, newAdmin);
    }

    /// @dev One record is an indivisible batch; quantity is descriptive metadata.
    function registerCredit(string calldata projectName, address initialOwner, uint256 quantity, string calldata documentHash)
        external onlyIssuer returns (uint256)
    {
        require(bytes(projectName).length > 0, "Project required");
        require(initialOwner != address(0), "Invalid owner");
        require(quantity > 0, "Quantity must be positive");

        uint256 id = nextCreditId++;
        credits[id] = CarbonCredit({
            id: id, projectName: projectName, issuer: msg.sender, owner: initialOwner,
            quantity: quantity, registeredAt: block.timestamp, retiredAt: 0,
            retired: false, documentHash: documentHash, retirementPurpose: ""
        });
        ownershipHistory[id].push(initialOwner);
        emit CreditRegistered(id, msg.sender, initialOwner, quantity, projectName, documentHash);
        return id;
    }

    function getCredit(uint256 creditId) external view returns (CarbonCredit memory) {
        require(_exists(creditId), "Credit not found");
        return credits[creditId];
    }

    function verifyOwnership(uint256 creditId, address account) external view returns (bool) {
        return _exists(creditId) && credits[creditId].owner == account;
    }

    function getOwnershipHistory(uint256 creditId) external view returns (address[] memory) {
        require(_exists(creditId), "Credit not found");
        return ownershipHistory[creditId];
    }

    function isRetired(uint256 creditId) external view returns (bool) {
        require(_exists(creditId), "Credit not found");
        return credits[creditId].retired;
    }

    function transferCredit(uint256 creditId, address newOwner) external {
        require(_exists(creditId), "Credit not found");
        CarbonCredit storage credit = credits[creditId];
        require(credit.owner == msg.sender, "Not the owner");
        require(!credit.retired, "Credit already retired");
        require(newOwner != address(0), "Invalid recipient");
        require(newOwner != msg.sender, "Already the owner");
        address previousOwner = credit.owner;
        credit.owner = newOwner;
        ownershipHistory[creditId].push(newOwner);
        emit CreditTransferred(creditId, previousOwner, newOwner);
    }

    function retireCredit(uint256 creditId, string calldata purpose) external {
        require(_exists(creditId), "Credit not found");
        CarbonCredit storage credit = credits[creditId];
        require(credit.owner == msg.sender, "Not the owner");
        require(!credit.retired, "Already retired");
        require(bytes(purpose).length > 0, "Purpose required");
        credit.retired = true;
        credit.retiredAt = block.timestamp;
        credit.retirementPurpose = purpose;
        emit CreditRetired(creditId, msg.sender, credit.quantity, purpose, block.timestamp);
    }

    function _exists(uint256 creditId) private view returns (bool) {
        return creditId > 0 && creditId < nextCreditId;
    }
}
