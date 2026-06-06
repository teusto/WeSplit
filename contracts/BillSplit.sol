// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BillSplit {
    struct Bill {
        address owner;
        uint256 totalAmount;
        uint64 deadline;
        string currency;
        bool settled;
        uint16 payerCount;
        uint16 paidCount;
        uint256 collectedAmount;
        uint256[] sharesWei;
        bool[] paid;
    }

    uint256 public nextBillId;
    mapping(uint256 => Bill) private bills;

    event BillCreated(
        uint256 indexed billId,
        address indexed owner,
        uint256 totalAmount,
        uint64 deadline,
        string currency,
        uint16 payerCount
    );

    event BillJoined(
        uint256 indexed billId,
        uint16 indexed slot,
        address indexed payer,
        uint256 amount
    );

    event BillSettled(
        uint256 indexed billId,
        address indexed owner,
        uint256 amount
    );

    error InvalidBill();
    error InvalidShares();
    error InvalidDeadline();
    error InvalidSlot();
    error SlotAlreadyPaid();
    error IncorrectPayment();
    error NotOwner();
    error AlreadySettled();
    error SettleNotReady();

    function createBill(
        uint256 totalAmount,
        uint16[] calldata sharesBps,
        uint64 deadline,
        string calldata currency
    ) external returns (uint256 billId) {
        if (sharesBps.length == 0 || totalAmount == 0) {
            revert InvalidShares();
        }
        if (deadline <= block.timestamp) {
            revert InvalidDeadline();
        }

        uint256 totalBps;
        uint256[] memory sharesWei = new uint256[](sharesBps.length);
        uint256 allocated;

        for (uint256 i = 0; i < sharesBps.length; i++) {
            uint16 bps = sharesBps[i];
            if (bps == 0) {
                revert InvalidShares();
            }
            totalBps += bps;
            uint256 amount = (totalAmount * bps) / 10_000;
            sharesWei[i] = amount;
            allocated += amount;
        }

        if (totalBps != 10_000) {
            revert InvalidShares();
        }

        if (allocated < totalAmount) {
            sharesWei[0] += (totalAmount - allocated);
        }

        billId = nextBillId;
        nextBillId += 1;

        Bill storage bill = bills[billId];
        bill.owner = msg.sender;
        bill.totalAmount = totalAmount;
        bill.deadline = deadline;
        bill.currency = currency;
        bill.payerCount = uint16(sharesBps.length);

        for (uint256 i = 0; i < sharesWei.length; i++) {
            bill.sharesWei.push(sharesWei[i]);
            bill.paid.push(false);
        }

        emit BillCreated(
            billId,
            msg.sender,
            totalAmount,
            deadline,
            currency,
            uint16(sharesBps.length)
        );
    }

    function joinBill(uint256 billId, uint16 slot) external payable {
        Bill storage bill = bills[billId];
        if (bill.owner == address(0)) {
            revert InvalidBill();
        }
        if (bill.settled) {
            revert AlreadySettled();
        }
        if (slot >= bill.payerCount) {
            revert InvalidSlot();
        }
        if (bill.paid[slot]) {
            revert SlotAlreadyPaid();
        }

        uint256 expected = bill.sharesWei[slot];
        if (msg.value != expected) {
            revert IncorrectPayment();
        }

        bill.paid[slot] = true;
        bill.paidCount += 1;
        bill.collectedAmount += msg.value;

        emit BillJoined(billId, slot, msg.sender, msg.value);
    }

    function settle(uint256 billId) external {
        Bill storage bill = bills[billId];
        if (bill.owner == address(0)) {
            revert InvalidBill();
        }
        if (msg.sender != bill.owner) {
            revert NotOwner();
        }
        if (bill.settled) {
            revert AlreadySettled();
        }

        bool allPaid = bill.paidCount == bill.payerCount;
        bool deadlinePassed = block.timestamp >= bill.deadline;

        if (!allPaid && !deadlinePassed) {
            revert SettleNotReady();
        }

        bill.settled = true;
        uint256 amount = bill.collectedAmount;
        bill.collectedAmount = 0;

        (bool ok, ) = bill.owner.call{value: amount}("");
        require(ok, "TRANSFER_FAILED");

        emit BillSettled(billId, bill.owner, amount);
    }

    function getBill(uint256 billId)
        external
        view
        returns (
            address owner,
            uint256 totalAmount,
            uint64 deadline,
            string memory currency,
            bool settled,
            uint16 payerCount,
            uint16 paidCount,
            uint256 collectedAmount
        )
    {
        Bill storage bill = bills[billId];
        if (bill.owner == address(0)) {
            revert InvalidBill();
        }

        return (
            bill.owner,
            bill.totalAmount,
            bill.deadline,
            bill.currency,
            bill.settled,
            bill.payerCount,
            bill.paidCount,
            bill.collectedAmount
        );
    }

    function getBillSlots(uint256 billId)
        external
        view
        returns (uint256[] memory sharesWei, bool[] memory paid)
    {
        Bill storage bill = bills[billId];
        if (bill.owner == address(0)) {
            revert InvalidBill();
        }

        return (bill.sharesWei, bill.paid);
    }
}
