// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CertificateRegistry {
    struct DomainRecord {
        string domain;
        bytes32 domainHash;
        address ownerAddress;
        uint256 registeredAt;
        bool exists;
    }

    struct CertificateRecord {
        bytes32 domainHash;
        bytes32 certHash;
        string issuer;
        string subject;
        string serialNumber;
        uint256 validFrom;
        uint256 validTo;
        string fingerprintAlgorithm;
        uint256 approvedAt;
        bool revoked;
        uint256 revokedAt;
        string memo;
    }

    struct CertificateStatusView {
        bool exists;
        bool approved;
        bool revoked;
        uint256 approvedAt;
        uint256 revokedAt;
        string issuer;
        string subject;
        string serialNumber;
        uint256 validFrom;
        uint256 validTo;
        string fingerprintAlgorithm;
        string memo;
    }

    error Unauthorized();
    error InvalidOwnerAddress();
    error InvalidDomain();
    error InvalidDomainHash();
    error InvalidCertificateHash();
    error InvalidFingerprintAlgorithm();
    error DomainAlreadyRegistered();
    error DomainNotRegistered();
    error CertificateNotApproved();

    event DomainRegistered(
        bytes32 indexed domainHash,
        string domain,
        address indexed ownerAddress,
        address indexed actor,
        uint256 registeredAt
    );

    event CertificateApproved(
        bytes32 indexed domainHash,
        bytes32 indexed certHash,
        address indexed actor,
        string issuer,
        string subject,
        string serialNumber,
        uint256 validFrom,
        uint256 validTo,
        string fingerprintAlgorithm,
        uint256 approvedAt,
        string memo
    );

    event CertificateRevoked(
        bytes32 indexed domainHash,
        bytes32 indexed certHash,
        address indexed actor,
        uint256 revokedAt,
        string memo
    );

    address public immutable admin;

    mapping(bytes32 => DomainRecord) private _domains;
    mapping(bytes32 => mapping(bytes32 => CertificateRecord)) private _certificates;
    mapping(bytes32 => bytes32[]) private _approvedCertHashesByDomain;
    mapping(bytes32 => mapping(bytes32 => bool)) private _trackedCertHashes;

    constructor(address admin_) {
        if (admin_ == address(0)) revert InvalidOwnerAddress();
        admin = admin_;
    }

    function registerDomain(string calldata domain, bytes32 domainHash, address ownerAddress)
        external
    {
        if (bytes(domain).length == 0) revert InvalidDomain();
        if (domainHash == bytes32(0)) revert InvalidDomainHash();
        if (ownerAddress == address(0)) revert InvalidOwnerAddress();
        if (_domains[domainHash].exists) revert DomainAlreadyRegistered();

        bool isAdmin = msg.sender == admin;
        bool isSelfRegistration = msg.sender == ownerAddress;
        if (!isAdmin && !isSelfRegistration) revert Unauthorized();

        _domains[domainHash] = DomainRecord({
            domain: domain,
            domainHash: domainHash,
            ownerAddress: ownerAddress,
            registeredAt: block.timestamp,
            exists: true
        });

        emit DomainRegistered(domainHash, domain, ownerAddress, msg.sender, block.timestamp);
    }

    function approveCertificate(
        bytes32 domainHash,
        bytes32 certHash,
        string calldata issuer,
        string calldata subject,
        string calldata serialNumber,
        uint256 validFrom,
        uint256 validTo,
        string calldata fingerprintAlgorithm,
        string calldata memo
    ) external {
        if (domainHash == bytes32(0)) revert InvalidDomainHash();
        if (certHash == bytes32(0)) revert InvalidCertificateHash();
        if (bytes(fingerprintAlgorithm).length == 0) revert InvalidFingerprintAlgorithm();

        _ensureRegisteredDomainAndAuthorizedCaller(domainHash);
        _storeApprovedCertificate(
            domainHash,
            certHash,
            issuer,
            subject,
            serialNumber,
            validFrom,
            validTo,
            fingerprintAlgorithm,
            memo
        );
        _trackApprovedCertificateHash(domainHash, certHash);
        _emitCertificateApproved(
            domainHash,
            certHash,
            issuer,
            subject,
            serialNumber,
            validFrom,
            validTo,
            fingerprintAlgorithm,
            memo
        );
    }

    function revokeCertificate(bytes32 domainHash, bytes32 certHash, string calldata memo)
        external
    {
        if (domainHash == bytes32(0)) revert InvalidDomainHash();
        if (certHash == bytes32(0)) revert InvalidCertificateHash();

        DomainRecord memory domainRecord = _domains[domainHash];
        if (!domainRecord.exists) revert DomainNotRegistered();
        _requireAdminOrDomainOwner(domainRecord.ownerAddress);

        CertificateRecord storage certificate = _certificates[domainHash][certHash];
        if (certificate.approvedAt == 0) revert CertificateNotApproved();

        certificate.revoked = true;
        certificate.revokedAt = block.timestamp;
        certificate.memo = memo;

        emit CertificateRevoked(domainHash, certHash, msg.sender, block.timestamp, memo);
    }

    function getCertificateStatus(bytes32 domainHash, bytes32 certHash)
        external
        view
        returns (CertificateStatusView memory status)
    {
        CertificateRecord storage certificate = _certificates[domainHash][certHash];

        status = CertificateStatusView({
            exists: certificate.approvedAt != 0,
            approved: certificate.approvedAt != 0,
            revoked: certificate.revoked,
            approvedAt: certificate.approvedAt,
            revokedAt: certificate.revokedAt,
            issuer: certificate.issuer,
            subject: certificate.subject,
            serialNumber: certificate.serialNumber,
            validFrom: certificate.validFrom,
            validTo: certificate.validTo,
            fingerprintAlgorithm: certificate.fingerprintAlgorithm,
            memo: certificate.memo
        });
    }

    function getDomainOwner(bytes32 domainHash)
        external
        view
        returns (address ownerAddress, bool exists)
    {
        DomainRecord storage domainRecord = _domains[domainHash];
        return (domainRecord.ownerAddress, domainRecord.exists);
    }

    function getApprovedCertificates(bytes32 domainHash) external view returns (bytes32[] memory) {
        return _approvedCertHashesByDomain[domainHash];
    }

    function _requireAdminOrDomainOwner(address ownerAddress) internal view {
        if (msg.sender != admin && msg.sender != ownerAddress) revert Unauthorized();
    }

    function _ensureRegisteredDomainAndAuthorizedCaller(bytes32 domainHash) internal view {
        DomainRecord storage domainRecord = _domains[domainHash];
        if (!domainRecord.exists) revert DomainNotRegistered();
        _requireAdminOrDomainOwner(domainRecord.ownerAddress);
    }

    function _storeApprovedCertificate(
        bytes32 domainHash,
        bytes32 certHash,
        string calldata issuer,
        string calldata subject,
        string calldata serialNumber,
        uint256 validFrom,
        uint256 validTo,
        string calldata fingerprintAlgorithm,
        string calldata memo
    ) internal {
        CertificateRecord storage certificate = _certificates[domainHash][certHash];
        certificate.domainHash = domainHash;
        certificate.certHash = certHash;
        certificate.issuer = issuer;
        certificate.subject = subject;
        certificate.serialNumber = serialNumber;
        certificate.validFrom = validFrom;
        certificate.validTo = validTo;
        certificate.fingerprintAlgorithm = fingerprintAlgorithm;
        certificate.approvedAt = block.timestamp;
        certificate.revoked = false;
        certificate.revokedAt = 0;
        certificate.memo = memo;
    }

    function _trackApprovedCertificateHash(bytes32 domainHash, bytes32 certHash) internal {
        if (_trackedCertHashes[domainHash][certHash]) return;

        _trackedCertHashes[domainHash][certHash] = true;
        _approvedCertHashesByDomain[domainHash].push(certHash);
    }

    function _emitCertificateApproved(
        bytes32 domainHash,
        bytes32 certHash,
        string calldata issuer,
        string calldata subject,
        string calldata serialNumber,
        uint256 validFrom,
        uint256 validTo,
        string calldata fingerprintAlgorithm,
        string calldata memo
    ) internal {
        emit CertificateApproved(
            domainHash,
            certHash,
            msg.sender,
            issuer,
            subject,
            serialNumber,
            validFrom,
            validTo,
            fingerprintAlgorithm,
            block.timestamp,
            memo
        );
    }
}
