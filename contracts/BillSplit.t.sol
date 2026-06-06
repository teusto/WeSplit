// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { BillSplit } from "./BillSplit.sol";

contract BillSplitTest is Test {
    BillSplit internal billSplit;

    address internal owner = makeAddr("owner");
    address internal payerA = makeAddr("payerA");
    address internal payerB = makeAddr("payerB");
    address internal payerC = makeAddr("payerC");

    function setUp() public {
        billSplit = new BillSplit();
    }

    function test_CreateBill_SetsOwnerAndPaysOwnerOnSettle() public {
        uint16[] memory sharesBps = new uint16[](2);
        sharesBps[0] = 5_000;
        sharesBps[1] = 5_000;

        uint256 totalAmount = 2 ether;
        uint64 deadline = uint64(block.timestamp + 1 days);

        vm.prank(owner);
        uint256 billId = billSplit.createBill(totalAmount, sharesBps, deadline, "MON");

        (address storedOwner,,,,,,,) = billSplit.getBill(billId);
        assertEq(storedOwner, owner, "owner should be stored as bill receiver");

        vm.deal(payerA, 1 ether);
        vm.prank(payerA);
        billSplit.joinBill{ value: 1 ether }(billId, 0);

        uint256 ownerBalanceBefore = owner.balance;

        vm.warp(deadline + 1);
        vm.prank(owner);
        billSplit.settle(billId);

        uint256 ownerBalanceAfter = owner.balance;
        assertEq(ownerBalanceAfter - ownerBalanceBefore, 1 ether, "settle should transfer collected amount to owner");
    }

    function test_AddPeopleAsPayers_TracksPaidSlotsAndCounts() public {
        uint16[] memory sharesBps = new uint16[](3);
        sharesBps[0] = 4_000;
        sharesBps[1] = 3_000;
        sharesBps[2] = 3_000;

        uint256 totalAmount = 10 ether;
        uint64 deadline = uint64(block.timestamp + 2 days);

        vm.prank(owner);
        uint256 billId = billSplit.createBill(totalAmount, sharesBps, deadline, "MON");

        vm.deal(payerA, 4 ether);
        vm.deal(payerB, 3 ether);

        vm.prank(payerA);
        billSplit.joinBill{ value: 4 ether }(billId, 0);

        vm.prank(payerB);
        billSplit.joinBill{ value: 3 ether }(billId, 1);

        (,,,,,uint16 payerCount, uint16 paidCount, uint256 collectedAmount) = billSplit.getBill(billId);
        assertEq(payerCount, 3, "all configured payers should be tracked");
        assertEq(paidCount, 2, "paid count should increase after joins");
        assertEq(collectedAmount, 7 ether, "collected amount should match paid slots");

        (uint256[] memory sharesWei, bool[] memory paid) = billSplit.getBillSlots(billId);
        assertEq(sharesWei.length, 3, "shares array length should match payer count");
        assertEq(sharesWei[0], 4 ether, "slot 0 share should be correct");
        assertEq(sharesWei[1], 3 ether, "slot 1 share should be correct");
        assertEq(sharesWei[2], 3 ether, "slot 2 share should be correct");

        assertTrue(paid[0], "slot 0 should be paid");
        assertTrue(paid[1], "slot 1 should be paid");
        assertFalse(paid[2], "slot 2 should remain unpaid");

        vm.deal(payerC, 3 ether);
        vm.prank(payerC);
        billSplit.joinBill{ value: 3 ether }(billId, 2);

        (,,,,,, paidCount, collectedAmount) = billSplit.getBill(billId);
        assertEq(paidCount, 3, "paid count should reach all payers");
        assertEq(collectedAmount, totalAmount, "collected amount should reach total once all pay");
    }
}
