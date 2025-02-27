/**
 * @jest-environment jsdom
 */

import { screen, fireEvent, waitFor } from "@testing-library/dom";
import NewBillUI from "../views/NewBillUI.js";
import NewBill from "../containers/NewBill.js";
import store from "../__mocks__/store";

const onNavigate = jest.fn();
const setupNewBillInstance = () => new NewBill({ document, onNavigate, store, localStorage });

describe("Given I am connected as an employee", () => {
  let newBillInstance, fileInput, handleChangeFile;

  beforeEach(() => {
    document.body.innerHTML = NewBillUI();
    window.localStorage.setItem("user", JSON.stringify({ email: "test@test.com" }));

    newBillInstance = setupNewBillInstance();
    fileInput = screen.getByTestId("file");

    handleChangeFile = jest.spyOn(newBillInstance, "handleChangeFile");
    fileInput.addEventListener("change", handleChangeFile);
  });

  const simulateFileUpload = (file) => {
    fireEvent.change(fileInput, { target: { files: file ? [file] : [] } });
  };

  describe("When I upload a file", () => {
    test("Then it should accept PNG, JPG, and JPEG files", async () => {
      const file = new File(["test"], "test.jpg", { type: "image/jpg" });
      simulateFileUpload(file);

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
      newBillInstance.store.bills = jest.fn(() => ({
        create: jest.fn().mockRejectedValue(new Error("Upload failed")),
      }));

      console.error = jest.fn();
      const file = new File(["test"], "test.jpg", { type: "image/jpg" });

      simulateFileUpload(file);

      await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.any(Error)));
    });
  });

  describe("When I submit the form", () => {
    test("Then it should call the handleSubmit method", () => {
      store.bills = jest.fn(() => ({
        update: jest.fn().mockResolvedValue({}),
      }));

      const form = screen.getByTestId("form-new-bill");
      const handleSubmit = jest.spyOn(newBillInstance, "handleSubmit");
      form.addEventListener("submit", handleSubmit);

      fireEvent.submit(form);

      expect(handleSubmit).toHaveBeenCalled();
    });
  });
});
