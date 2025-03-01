/**
 * @jest-environment jsdom
 */

import { screen, fireEvent, waitFor } from "@testing-library/dom";
import NewBillUI from "../views/NewBillUI.js";
import NewBill from "../containers/NewBill.js";
import { ROUTES } from "../constants/routes";
import mockStore from "../__mocks__/store";
import { localStorageMock } from "../__mocks__/localStorage.js";

jest.mock("../app/store", () => mockStore);

let newBillInstance;
let onNavigate;

describe("Given I am connected as an employee", () => {
  beforeEach(() => {
    jest.spyOn(mockStore, "bills").mockImplementation(() => ({
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    }));
    
    onNavigate = (pathname) => {
      document.body.innerHTML = ROUTES({ pathname });
    }

    Object.defineProperty(window, "localStorage", { value: localStorageMock });
    window.localStorage.setItem("user", JSON.stringify({
      type: "Employee",
      eamil: "test@test.com"
    }));

    const setupNewBillInstance = () => new NewBill({ document, onNavigate, store: mockStore, localStorage });

    document.body.innerHTML = NewBillUI();
    newBillInstance = setupNewBillInstance();
  });

  describe("When I am on NewBills Page and I upload a file", () => {
    let fileInput, handleChangeFile;

    beforeEach(() => {
      fileInput = screen.getByTestId("file");
      handleChangeFile = jest.spyOn(newBillInstance, "handleChangeFile");
      fileInput.addEventListener("change", handleChangeFile);
    });

    const simulateFileUpload = (file) => {
      fireEvent.change(fileInput, { target: { files: file ? [file] : [] } });
    };

    test("Then it should accept PNG, JPG, and JPEG files", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpg" });
      
      simulateFileUpload(file);

      expect(handleChangeFile).toHaveBeenCalled();
      await waitFor(() => expect(fileInput.files[0]).toBe(file));
    });

    test("Then it should reject unsupported file types", () => {
      window.alert = jest.fn();
      const file = new File(["test"], "test.pdf", { type: "application/pdf" });

      simulateFileUpload(file);

      expect(handleChangeFile).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith("Seuls les fichiers PNG, JPG et JPEG sont acceptés.");
    });

    test("Then it should do nothing if no file is selected", () => {
      simulateFileUpload(null);

      expect(handleChangeFile).toHaveBeenCalled();
      expect(newBillInstance.fileUrl).toBe(null);
      expect(newBillInstance.fileName).toBe(null);
    });

    test("Then it should log an error if file upload fails", async () => {
      jest.spyOn(mockStore, "bills").mockImplementation(() => ({
        create: jest.fn().mockRejectedValue(new Error("Upload failed")),
      }));
      console.error = jest.fn();
      const file = new File(["test"], "test.jpg", { type: "image/jpg" });

      simulateFileUpload(file);

      await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(Error)));
    });
  });

  // Integration test POST new bill
  describe("When I am on NewBills Page and I submit the form", () => {
    let form, handleSubmit;

    beforeEach(() => {
      form = screen.getByTestId("form-new-bill");
      handleSubmit = jest.spyOn(newBillInstance, "handleSubmit");
      form.addEventListener("submit", handleSubmit);
    });

    test("Then it should call the handleSubmit method", () => {
      fireEvent.submit(form);

      expect(handleSubmit).toHaveBeenCalled();
    });

    test("Then it should correctly retrieve and use form input values", async () => {
      const inputValues = {
        type: "Transports",
        name: "Test",
        amount: 348,
        date: "2025-02-27",
        vat: "70",
        pct: 20,
        commentary: "Commentaire Test",
        fileUrl: null,
        fileName: null,
        status: "pending",
      };

      screen.getByTestId("expense-type").value = inputValues.type;
      screen.getByTestId("expense-name").value = inputValues.name;
      screen.getByTestId("amount").value = inputValues.amount;
      screen.getByTestId("datepicker").value = inputValues.date;
      screen.getByTestId("vat").value = inputValues.vat;
      screen.getByTestId("pct").value = inputValues.pct;
      screen.getByTestId("commentary").value = inputValues.commentary;

      const updateObject = {
        data: JSON.stringify({
          email: JSON.parse(window.localStorage.getItem("user")).email,
          ...inputValues
        }),
        selector: null
      };

      // jest.spyOn(mockStore, "bills").mockImplementation(() => ({
      //   update: jest.fn().mockResolvedValue(updateObject),
      // }));
      mockStore.bills = jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue(updateObject),
      });

      fireEvent.submit(form);
      
      await waitFor(() => expect(mockStore.bills().update).toHaveBeenCalledWith(updateObject));
    });

    describe("When an error occurs on API", () => {
      test("Then it should log an 404 error when API responds with 404", async () => {
        jest.spyOn(mockStore, "bills").mockImplementation(() => ({
          update: jest.fn().mockRejectedValue({ response: { status: 404 } }),
        }));
        console.error = jest.fn();
  
        fireEvent.submit(form);
  
        await waitFor(() => expect(console.error).toHaveBeenCalledWith({ response: { status: 404 } }));
      });
  
      test("Then it should log an 500 error when API responds with 500", async () => {
        jest.spyOn(mockStore, "bills").mockImplementation(() => ({
          update: jest.fn().mockRejectedValue({ response: { status: 500 } }),
        }));
        console.error = jest.fn();
  
        fireEvent.submit(form);
  
        await waitFor(() => expect(console.error).toHaveBeenCalledWith({ response: { status: 500 } }));
      });
    });
  });
});
