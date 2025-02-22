/**
 * @jest-environment jsdom
 */

import { fireEvent, screen, waitFor } from "@testing-library/dom";
import BillsUI from "../views/BillsUI.js";
import { bills } from "../fixtures/bills.js";
import { ROUTES_PATH } from "../constants/routes.js";
import { localStorageMock } from "../__mocks__/localStorage.js";
import Bills from "../containers/Bills.js";
import { formatDate, formatStatus } from "../app/format.js";
import router from "../app/Router.js";

console.log = jest.fn();

const onNavigate = jest.fn();

const setupBillsInstance = (store = null) =>
  new Bills({
    document,
    onNavigate,
    store,
    localStorage: window.localStorage,
  });

const mockStore = (data) => ({
  bills: jest.fn(() => ({
    list: jest.fn(() => Promise.resolve(data)),
  })),
});

describe("Given I am connected as an employee", () => {
  beforeEach(() => {
    document.body.innerHTML = BillsUI({ data: bills });
  });

  describe("When I am on Bills Page", () => {
    test("Then bill icon in vertical layout should be highlighted", async () => {
      Object.defineProperty(window, "localStorage", {
        value: localStorageMock,
      });
      window.localStorage.setItem(
        "user",
        JSON.stringify({
          type: "Employee",
        })
      );
      document.body.innerHTML = '';
      const root = document.createElement("div");
      root.setAttribute("id", "root");
      document.body.append(root);
      router();
      window.onNavigate(ROUTES_PATH.Bills);
      await waitFor(() => screen.getByTestId("icon-window"));
      const windowIcon = screen.getByTestId("icon-window");
      //to-do write expect expression
      expect(windowIcon.classList).toContain("active-icon");
    });

    test("Then bills should be ordered from earliest to latest", () => {
      const dates = screen
        .getAllByText(
          /^(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])$/i
        )
        .map((a) => a.innerHTML);
      const antiChrono = (a, b) => (a < b ? 1 : -1);
      const datesSorted = [...dates].sort(antiChrono);
      expect(dates).toEqual(datesSorted);
    });

    test("Then the 'New Bill' button should have a click event listener", () => {
      setupBillsInstance();

      const buttonNewBill = screen.getByTestId("btn-new-bill");
      fireEvent.click(buttonNewBill);

      expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH.NewBill);
    });

    test("Then clicking on an eye icon should open a modal of the bill image", () => {
      const billsInstance = setupBillsInstance();
      $.fn.modal = jest.fn();

      const handleClickIconEyeSpy = jest.spyOn(billsInstance, "handleClickIconEye");

      const iconsEye = screen.getAllByTestId("icon-eye");

      fireEvent.click(iconsEye[0]);

      expect(handleClickIconEyeSpy).toHaveBeenCalledWith(iconsEye[0]);
    });
  });

  describe("When I call getBills()", () => {
    test("Then it should return formatted bills", async () => {
      const store = mockStore(bills);

      const billsInstance = setupBillsInstance(store)

      const result = await billsInstance.getBills();

      expect(result).toEqual(
        bills.map((bill) => ({
          ...bill,
          date: formatDate(bill.date),
          status: formatStatus(bill.status),
        }))
      );
      expect(console.log).toHaveBeenCalledWith("length", bills.length);
    });

    test("Then it should return unformatted date if formatDate throws an error", async () => {
      const corruptedBills = [
        { id: "1", date: "invalid-date", status: "pending" },
      ];

      const store = mockStore(corruptedBills);

      const billsInstance = setupBillsInstance(store);

      const result = await billsInstance.getBills();

      expect(result).toEqual([
        {
          ...corruptedBills[0],
          date: "invalid-date",
          status: formatStatus("pending"),
        },
      ]);

      expect(console.log).toHaveBeenCalledWith(
        expect.any(Error),
        "for",
        corruptedBills[0]
      );
    });

    test("Then it should return undefined if store is null", async () => {
      const billsInstance = setupBillsInstance();
      const result = await billsInstance.getBills();
      expect(result).toBeUndefined();
    });
  });
});
