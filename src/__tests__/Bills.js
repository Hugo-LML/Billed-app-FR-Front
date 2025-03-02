/**
 * @jest-environment jsdom
 */

import { fireEvent, screen, waitFor } from "@testing-library/dom";
import BillsUI from "../views/BillsUI.js";
import { bills } from "../fixtures/bills.js";
import { ROUTES_PATH, ROUTES } from "../constants/routes.js";
import mockStore from "../__mocks__/store";
import { localStorageMock } from "../__mocks__/localStorage.js";
import Bills from "../containers/Bills.js";
import { formatDate, formatStatus } from "../app/format.js";
import router from "../app/Router.js";

jest.mock("../app/store", () => mockStore);

let billsInstance;
let onNavigate;

describe("Given I am connected as an employee", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(mockStore, "bills").mockImplementation(() => ({
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    }));

    console.log = jest.fn();
    console.error = jest.fn();
    
    onNavigate = jest.fn((pathname) => {
      document.body.innerHTML = ROUTES({ pathname });
    });

    Object.defineProperty(window, "localStorage", { value: localStorageMock });
    window.localStorage.setItem("user", JSON.stringify({
      type: "Employee",
      email: "test@test.com"
    }));

    const setupBillsInstance = () => new Bills({ document, onNavigate, store: mockStore, localStorage });

    document.body.innerHTML = BillsUI({ data: bills });
    billsInstance = setupBillsInstance();
  });

  describe("When I am on Bills Page", () => {
    test("Then bill icon in vertical layout should be highlighted", async () => {
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
        .getAllByText(/^(19|20)\d\d[- /.](0[1-9]|1[012])[- /.](0[1-9]|[12][0-9]|3[01])$/i)
        .map((a) => a.innerHTML);
      const antiChrono = (a, b) => (a < b ? 1 : -1);
      const datesSorted = [...dates].sort(antiChrono);
      expect(dates).toEqual(datesSorted);
    });

    test("Then all bills should be displayed", () => {
      const billLines = screen.getByTestId("tbody").children.length;

      expect(billLines).toBe(bills.length);
    });

    test("Then the 'New Bill' button should have a click event listener", () => {
      const buttonNewBill = screen.getByTestId("btn-new-bill");

      fireEvent.click(buttonNewBill);

      expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH["NewBill"]);
      expect(screen.getByText("Envoyer une note de frais")).toBeTruthy();
    });

    test("Then clicking on an eye icon should open a modal of the bill image", async () => {
      $.fn.modal = jest.fn(); // mock bootstrap modal

      const handleClickIconEyeSpy = jest.spyOn(billsInstance, "handleClickIconEye");

      const iconsEye = screen.getAllByTestId("icon-eye");

      fireEvent.click(iconsEye[0]);

      expect(handleClickIconEyeSpy).toHaveBeenCalledWith(iconsEye[0]);
      const billProofContainer = screen.getByTestId("bill-proof-container");
      await waitFor(() => expect(billProofContainer).toBeTruthy());
    });
  });

  // Integration test GET bills
  describe("When I am on Bills Page and I call getBills()", () => {
    test("Then it should return formatted bills", async () => {
      jest.spyOn(mockStore, "bills").mockImplementation(() => ({
        list: jest.fn().mockResolvedValue(bills),
      }));
      
      const result = await billsInstance.getBills();

      expect(result).toEqual(bills.map(bill => ({
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

      jest.spyOn(mockStore, "bills").mockImplementation(() => ({
        list: jest.fn().mockResolvedValue(corruptedBills),
      }));

      const result = await billsInstance.getBills();

      expect(result).toEqual([
        {
          ...corruptedBills[0],
          date: corruptedBills[0].date,
          status: formatStatus(corruptedBills[0].status),
        },
      ]);
      expect(console.log).toHaveBeenCalledWith(expect.any(Error), "for", corruptedBills[0]);
    });

    test("Then it should return undefined if store is null", async () => {
      billsInstance = new Bills({ document, onNavigate, store: null, localStorage });

      const result = await billsInstance.getBills();

      expect(result).toBeUndefined();
    });
  });

  describe("When an error occurs on API", () => {
    test("Then it should log a 404 error when API responds with 404", async () => {
      jest.spyOn(mockStore, "bills").mockImplementation(() => ({
        list: jest.fn().mockRejectedValue(new Error("Erreur 404")),
      }));
    
      await expect(billsInstance.getBills()).rejects.toThrow("Erreur 404");
    });
  
    test("Then it should log a 500 error when API responds with 500", async () => {
      jest.spyOn(mockStore, "bills").mockImplementation(() => ({
        list: jest.fn().mockRejectedValue(new Error("Erreur 500")),
      }));
    
      await expect(billsInstance.getBills()).rejects.toThrow("Erreur 500");
    });
  });
});
