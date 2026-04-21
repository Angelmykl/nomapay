// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title NomaPay
 * @notice Username-based USDC/EURC payment registry on Arc Testnet
 */
contract NomaPay {
    address public owner;
    address public usdc;
    address public eurc;

    uint256 public registrationFee;
    uint256 public transferFeeBps;
    uint256 public swapFeeBps;

    mapping(string => address) private usernameToAddress;
    mapping(address => string) private addressToUsername;

    event UsernameRegistered(string indexed username, address indexed wallet);
    event TokenSent(string indexed fromUsername, string indexed toUsername, address token, uint256 amount, uint256 fee);
    event FeeUpdated(string feeType, uint256 newValue);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    error NotOwner();
    error UsernameTaken();
    error UsernameNotFound();
    error AlreadyRegistered();
    error InvalidUsername();
    error ZeroAmount();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address _usdc,
        address _eurc,
        uint256 _registrationFee,
        uint256 _transferFeeBps,
        uint256 _swapFeeBps
    ) {
        owner = msg.sender;
        usdc = _usdc;
        eurc = _eurc;
        registrationFee = _registrationFee;
        transferFeeBps = _transferFeeBps;
        swapFeeBps = _swapFeeBps;
    }

    function registerUsername(string calldata username) external {
        _validateUsername(username);
        if (usernameToAddress[username] != address(0)) revert UsernameTaken();
        if (bytes(addressToUsername[msg.sender]).length != 0) revert AlreadyRegistered();
        if (registrationFee > 0) {
            bool ok = IERC20(usdc).transferFrom(msg.sender, address(this), registrationFee);
            require(ok, "Fee transfer failed");
        }
        usernameToAddress[username] = msg.sender;
        addressToUsername[msg.sender] = username;
        emit UsernameRegistered(username, msg.sender);
    }

    function sendToUsername(string calldata toUsername, address token, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        require(token == usdc || token == eurc, "Unsupported token");
        address recipient = usernameToAddress[toUsername];
        if (recipient == address(0)) revert UsernameNotFound();
        uint256 fee = (amount * transferFeeBps) / 10000;
        uint256 netAmount = amount - fee;
        bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "Transfer failed");
        bool ok2 = IERC20(token).transfer(recipient, netAmount);
        require(ok2, "Recipient transfer failed");
        string memory fromUsername = addressToUsername[msg.sender];
        emit TokenSent(fromUsername, toUsername, token, netAmount, fee);
    }

    function swap(address fromToken, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        require(fromToken == usdc || fromToken == eurc, "Unsupported token");
        address toToken = (fromToken == usdc) ? eurc : usdc;
        uint256 fee = (amount * swapFeeBps) / 10000;
        uint256 netOut = amount - fee;
        require(IERC20(toToken).balanceOf(address(this)) >= netOut, "Insufficient liquidity");
        bool ok = IERC20(fromToken).transferFrom(msg.sender, address(this), amount);
        require(ok, "Input transfer failed");
        bool ok2 = IERC20(toToken).transfer(msg.sender, netOut);
        require(ok2, "Output transfer failed");
    }

    function getAddress(string calldata username) external view returns (address) {
        return usernameToAddress[username];
    }

    function getUsername(address wallet) external view returns (string memory) {
        return addressToUsername[wallet];
    }

    function isUsernameTaken(string calldata username) external view returns (bool) {
        return usernameToAddress[username] != address(0);
    }

    function hasUsername(address wallet) external view returns (bool) {
        return bytes(addressToUsername[wallet]).length != 0;
    }

    function withdrawFees(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    function setRegistrationFee(uint256 fee) external onlyOwner {
        registrationFee = fee;
        emit FeeUpdated("registration", fee);
    }

    function setTransferFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 500, "Max 5%");
        transferFeeBps = bps;
        emit FeeUpdated("transfer", bps);
    }

    function setSwapFeeBps(uint256 bps) external onlyOwner {
        require(bps <= 200, "Max 2%");
        swapFeeBps = bps;
        emit FeeUpdated("swap", bps);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _validateUsername(string calldata username) internal pure {
        bytes memory b = bytes(username);
        uint256 len = b.length;
        if (len < 3 || len > 20) revert InvalidUsername();
        for (uint256 i = 0; i < len; i++) {
            bytes1 c = b[i];
            bool valid = (c >= 0x61 && c <= 0x7A) ||
                         (c >= 0x30 && c <= 0x39) ||
                         (c == 0x5F);
            if (!valid) revert InvalidUsername();
        }
    }
}
