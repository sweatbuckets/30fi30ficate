// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/CertificateRegistry.sol";
import "./utils/TestBase.sol";

contract CertificateRegistryTest is TestBase {
    CertificateRegistry internal registry;

    address internal constant ADMIN = address(0xA11CE);
    address internal constant DOMAIN_OWNER = address(0xB0B);
    address internal constant ATTACKER = address(0xBAD);

    bytes32 internal constant DOMAIN_HASH = keccak256("11155111:example.com");
    bytes32 internal constant CERT_HASH = keccak256("cert-1");
    bytes32 internal constant CERT_HASH_2 = keccak256("cert-2");

    string internal constant DOMAIN = "example.com";
    string internal constant ISSUER = "Test CA";
    string internal constant SUBJECT = "CN=example.com";
    string internal constant SERIAL = "00A1";
    string internal constant FINGERPRINT_ALGO = "SHA-256";

    function setUp() external {
        vm.prank(ADMIN);
        registry = new CertificateRegistry(ADMIN);
    }

    function testAdminCanRegisterDomain() external {
        vm.prank(ADMIN);
        registry.registerDomain(DOMAIN, DOMAIN_HASH, DOMAIN_OWNER);

        (address ownerAddress, bool exists) = registry.getDomainOwner(DOMAIN_HASH);
        assertEq(ownerAddress, DOMAIN_OWNER);
        assertTrue(exists);
    }

    function testDomainOwnerCanSelfRegisterDomain() external {
        vm.prank(DOMAIN_OWNER);
        registry.registerDomain(DOMAIN, DOMAIN_HASH, DOMAIN_OWNER);

        (address ownerAddress, bool exists) = registry.getDomainOwner(DOMAIN_HASH);
        assertEq(ownerAddress, DOMAIN_OWNER);
        assertTrue(exists);
    }

    function testRegisterDomainRejectsUnauthorizedCaller() external {
        vm.prank(ATTACKER);
        vm.expectRevert(CertificateRegistry.Unauthorized.selector);
        registry.registerDomain(DOMAIN, DOMAIN_HASH, DOMAIN_OWNER);
    }

    function testRegisterDomainRejectsEmptyDomain() external {
        vm.prank(ADMIN);
        vm.expectRevert(CertificateRegistry.InvalidDomain.selector);
        registry.registerDomain("", DOMAIN_HASH, DOMAIN_OWNER);
    }

    function testRegisterDomainRejectsZeroOwnerAddress() external {
        vm.prank(ADMIN);
        vm.expectRevert(CertificateRegistry.InvalidOwnerAddress.selector);
        registry.registerDomain(DOMAIN, DOMAIN_HASH, address(0));
    }

    function testRegisterDomainRejectsZeroDomainHash() external {
        vm.prank(ADMIN);
        vm.expectRevert(CertificateRegistry.InvalidDomainHash.selector);
        registry.registerDomain(DOMAIN, bytes32(0), DOMAIN_OWNER);
    }

    function testCannotRegisterDomainTwice() external {
        vm.startPrank(ADMIN);
        registry.registerDomain(DOMAIN, DOMAIN_HASH, DOMAIN_OWNER);
        vm.expectRevert(CertificateRegistry.DomainAlreadyRegistered.selector);
        registry.registerDomain(DOMAIN, DOMAIN_HASH, DOMAIN_OWNER);
        vm.stopPrank();
    }

    function testDomainOwnerCanApproveCertificate() external {
        _registerDomain();

        vm.prank(DOMAIN_OWNER);
        registry.approveCertificate(
            DOMAIN_HASH,
            CERT_HASH,
            ISSUER,
            SUBJECT,
            SERIAL,
            1_700_000_000,
            1_800_000_000,
            FINGERPRINT_ALGO,
            "initial approval"
        );

        CertificateRegistry.CertificateStatusView memory status =
            registry.getCertificateStatus(DOMAIN_HASH, CERT_HASH);

        assertTrue(status.exists);
        assertTrue(status.approved);
        assertFalse(status.revoked);
        assertEq(status.issuer, ISSUER);
        assertEq(status.subject, SUBJECT);
        assertEq(status.serialNumber, SERIAL);
        assertEq(status.validFrom, 1_700_000_000);
        assertEq(status.validTo, 1_800_000_000);
        assertEq(status.fingerprintAlgorithm, FINGERPRINT_ALGO);
        assertEq(status.memo, "initial approval");
    }

    function testAdminCanApproveCertificateForRegisteredDomain() external {
        _registerDomain();

        vm.prank(ADMIN);
        registry.approveCertificate(
            DOMAIN_HASH,
            CERT_HASH,
            ISSUER,
            SUBJECT,
            SERIAL,
            1,
            2,
            FINGERPRINT_ALGO,
            "admin approval"
        );

        CertificateRegistry.CertificateStatusView memory status =
            registry.getCertificateStatus(DOMAIN_HASH, CERT_HASH);
        assertTrue(status.approved);
    }

    function testApproveRequiresRegisteredDomain() external {
        vm.prank(ADMIN);
        vm.expectRevert(CertificateRegistry.DomainNotRegistered.selector);
        registry.approveCertificate(
            DOMAIN_HASH,
            CERT_HASH,
            ISSUER,
            SUBJECT,
            SERIAL,
            1,
            2,
            FINGERPRINT_ALGO,
            "missing domain"
        );
    }

    function testApproveRejectsUnauthorizedCaller() external {
        _registerDomain();

        vm.prank(ATTACKER);
        vm.expectRevert(CertificateRegistry.Unauthorized.selector);
        registry.approveCertificate(
            DOMAIN_HASH, CERT_HASH, ISSUER, SUBJECT, SERIAL, 1, 2, FINGERPRINT_ALGO, "unauthorized"
        );
    }

    function testApproveRejectsZeroCertificateHash() external {
        _registerDomain();

        vm.prank(DOMAIN_OWNER);
        vm.expectRevert(CertificateRegistry.InvalidCertificateHash.selector);
        registry.approveCertificate(
            DOMAIN_HASH, bytes32(0), ISSUER, SUBJECT, SERIAL, 1, 2, FINGERPRINT_ALGO, "bad hash"
        );
    }

    function testApproveRejectsEmptyFingerprintAlgorithm() external {
        _registerDomain();

        vm.prank(DOMAIN_OWNER);
        vm.expectRevert(CertificateRegistry.InvalidFingerprintAlgorithm.selector);
        registry.approveCertificate(
            DOMAIN_HASH, CERT_HASH, ISSUER, SUBJECT, SERIAL, 1, 2, "", "bad"
        );
    }

    function testRevokeApprovedCertificate() external {
        _registerDomain();
        _approveCertificate(CERT_HASH, "approved");

        vm.prank(DOMAIN_OWNER);
        registry.revokeCertificate(DOMAIN_HASH, CERT_HASH, "revoked by owner");

        CertificateRegistry.CertificateStatusView memory status =
            registry.getCertificateStatus(DOMAIN_HASH, CERT_HASH);
        assertTrue(status.exists);
        assertTrue(status.approved);
        assertTrue(status.revoked);
        assertGt(status.revokedAt, 0);
        assertEq(status.memo, "revoked by owner");
    }

    function testRevokeRequiresExistingApproval() external {
        _registerDomain();

        vm.prank(DOMAIN_OWNER);
        vm.expectRevert(CertificateRegistry.CertificateNotApproved.selector);
        registry.revokeCertificate(DOMAIN_HASH, CERT_HASH, "missing approval");
    }

    function testGetDomainOwnerReturnsFalseForUnknownDomain() external view {
        (address ownerAddress, bool exists) = registry.getDomainOwner(bytes32(uint256(999)));
        assertEq(ownerAddress, address(0));
        assertFalse(exists);
    }

    function testGetCertificateStatusReturnsEmptyViewForUnknownCertificate() external view {
        CertificateRegistry.CertificateStatusView memory status =
            registry.getCertificateStatus(DOMAIN_HASH, CERT_HASH);

        assertFalse(status.exists);
        assertFalse(status.approved);
        assertFalse(status.revoked);
        assertEq(status.approvedAt, 0);
        assertEq(status.revokedAt, 0);
        assertEq(status.issuer, "");
        assertEq(status.subject, "");
        assertEq(status.serialNumber, "");
        assertEq(status.validFrom, 0);
        assertEq(status.validTo, 0);
        assertEq(status.fingerprintAlgorithm, "");
        assertEq(status.memo, "");
    }

    function testApproveCanReactivateRevokedCertificate() external {
        _registerDomain();
        _approveCertificate(CERT_HASH, "first approval");

        vm.prank(ADMIN);
        registry.revokeCertificate(DOMAIN_HASH, CERT_HASH, "revoked");

        vm.prank(DOMAIN_OWNER);
        registry.approveCertificate(
            DOMAIN_HASH, CERT_HASH, ISSUER, SUBJECT, SERIAL, 10, 20, FINGERPRINT_ALGO, "reactivated"
        );

        CertificateRegistry.CertificateStatusView memory status =
            registry.getCertificateStatus(DOMAIN_HASH, CERT_HASH);
        assertTrue(status.approved);
        assertFalse(status.revoked);
        assertEq(status.revokedAt, 0);
        assertEq(status.memo, "reactivated");
    }

    function testGetApprovedCertificatesTracksUniqueHashes() external {
        _registerDomain();
        _approveCertificate(CERT_HASH, "one");
        _approveCertificate(CERT_HASH, "two");
        _approveCertificate(CERT_HASH_2, "three");

        bytes32[] memory certHashes = registry.getApprovedCertificates(DOMAIN_HASH);
        assertEq(certHashes.length, 2);
        assertEq(certHashes[0], CERT_HASH);
        assertEq(certHashes[1], CERT_HASH_2);
    }

    function testEmitsDomainRegisteredEvent() external {
        vm.expectEmit(true, false, true, true);
        emit CertificateRegistry.DomainRegistered(
            DOMAIN_HASH, DOMAIN, DOMAIN_OWNER, ADMIN, block.timestamp
        );

        vm.prank(ADMIN);
        registry.registerDomain(DOMAIN, DOMAIN_HASH, DOMAIN_OWNER);
    }

    function testEmitsCertificateApprovedEvent() external {
        _registerDomain();

        vm.expectEmit(true, true, true, true);
        emit CertificateRegistry.CertificateApproved(
            DOMAIN_HASH,
            CERT_HASH,
            DOMAIN_OWNER,
            ISSUER,
            SUBJECT,
            SERIAL,
            1,
            2,
            FINGERPRINT_ALGO,
            block.timestamp,
            "approved"
        );

        vm.prank(DOMAIN_OWNER);
        registry.approveCertificate(
            DOMAIN_HASH, CERT_HASH, ISSUER, SUBJECT, SERIAL, 1, 2, FINGERPRINT_ALGO, "approved"
        );
    }

    function testEmitsCertificateRevokedEvent() external {
        _registerDomain();
        _approveCertificate(CERT_HASH, "approved");

        vm.expectEmit(true, true, true, true);
        emit CertificateRegistry.CertificateRevoked(
            DOMAIN_HASH, CERT_HASH, ADMIN, block.timestamp, "revoked"
        );

        vm.prank(ADMIN);
        registry.revokeCertificate(DOMAIN_HASH, CERT_HASH, "revoked");
    }

    function _registerDomain() internal {
        vm.prank(ADMIN);
        registry.registerDomain(DOMAIN, DOMAIN_HASH, DOMAIN_OWNER);
    }

    function _approveCertificate(bytes32 certHash, string memory memo) internal {
        vm.prank(DOMAIN_OWNER);
        registry.approveCertificate(
            DOMAIN_HASH, certHash, ISSUER, SUBJECT, SERIAL, 1, 2, FINGERPRINT_ALGO, memo
        );
    }
}
