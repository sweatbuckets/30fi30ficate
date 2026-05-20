// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/CertificateRegistry.sol";
import "./utils/ScriptBase.sol";

contract DeployCertificateRegistry is ScriptBase {
    function run() external returns (CertificateRegistry registry) {
        address admin = vm.envAddress("REGISTRY_ADMIN");

        vm.startBroadcast();
        registry = new CertificateRegistry(admin);
        vm.stopBroadcast();
    }
}
