import { describe, test, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { installFakeApi } from "./fakeApi.js";

const logIn = () => localStorage.setItem("phq_token", "tok");
const renderAt = (entry) => render(<MemoryRouter initialEntries={[entry]}><App /></MemoryRouter>);
const project = (over = {}) => ({ id: "p1", name: "Christ Life", client: "Christ Life Church", contactName: "Joe", contact: "0770", type: "Website", billing: "paid", status: "active", phase: 3,
  phaseDates: { 0: "2026-01-02" }, nextStep: "Send the proposal", waitingOn: "me", waitingSince: "", scope: [], payments: [], content: [], depositPct: 10, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", ...over });

describe("receipt rules in the editor", () => {
  test("Save PDF stays off until the money is confirmed and the details are filled in", async () => {
    installFakeApi({ projects: [project({ phase: 7 })] });
    logIn();
    const user = userEvent.setup();
    renderAt({ pathname: "/docs/new/receipt", state: { projectId: "p1" } });
    await screen.findByLabelText("Amount received (USD)");
    await user.click(screen.getByRole("button", { name: "2. Preview & save" }));
    expect(await screen.findByText("Fix these before saving the file:")).toBeInTheDocument();
    expect(screen.getByText(/I confirm I have received this money/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Word file" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "1. Fill in" }));
    await user.type(screen.getByLabelText("Amount received (USD)"), "30");
    await user.selectOptions(screen.getByLabelText("Payment method"), "Cash");
    await user.click(screen.getByLabelText(/I confirm I have received this money/));
    await user.click(screen.getByRole("button", { name: "2. Preview & save" }));
    expect(await screen.findByText("Everything needed is filled in.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save PDF" })).toBeEnabled();
  });

  test("saving a confirmed receipt adds one payment, moves the project, and re-saving adds no second one", async () => {
    const db = installFakeApi({ projects: [project({ phase: 7, nextStep: "Wait for the deposit", waitingOn: "client", scope: [{ item: "Site", price: 300 }] })] });
    logIn();
    const user = userEvent.setup();
    renderAt({ pathname: "/docs/new/receipt", state: { projectId: "p1" } });
    const amount = await screen.findByLabelText("Amount received (USD)");
    await user.clear(amount); await user.type(amount, "30");
    await user.selectOptions(screen.getByLabelText("Payment method"), "Orange Money");
    await user.click(screen.getByLabelText(/I confirm I have received this money/));
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(db.docs).toHaveLength(1));
    expect(db.docs[0].number).toMatch(/^RCT-\d{4}-001$/); // the number comes from the server
    expect(db.projects[0].payments).toHaveLength(1);
    expect(db.projects[0].payments[0]).toMatchObject({ amount: 30, receiptNo: db.docs[0].number });
    await waitFor(() => expect(db.projects[0].phase).toBe(8)); // deposit received
    expect(db.projects[0].nextStep).toBe("Send the content checklist");

    // edit and save again
    await user.clear(screen.getByLabelText("Amount received (USD)")); await user.type(screen.getByLabelText("Amount received (USD)"), "35");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(db.projects[0].payments[0].amount).toBe(35));
    expect(db.projects[0].payments).toHaveLength(1);
    expect(db.docs).toHaveLength(1);
  });
});

describe("a document moves its project forward, and Undo puts it back", () => {
  test("proposal Sent then Accepted, then Undo", async () => {
    const db = installFakeApi({ projects: [project()] });
    logIn();
    const user = userEvent.setup();
    renderAt({ pathname: "/docs/new/proposal", state: { projectId: "p1" } });
    const status = await screen.findByLabelText("Status");

    await user.selectOptions(status, "Sent");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(db.projects[0].phase).toBe(4));
    expect(db.projects[0]).toMatchObject({ nextStep: "Follow up on the proposal", waitingOn: "client" });
    expect(await screen.findByText(/moved to “Proposal sent”/)).toBeInTheDocument();
    expect(db.docs[0].number).toMatch(/^PRO-\d{4}-001$/);

    await user.selectOptions(screen.getByLabelText("Status"), "Accepted");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(db.projects[0].phase).toBe(5));
    expect(db.projects[0].nextStep).toBe("Send the contract");
    expect(screen.getByRole("button", { name: "Create deposit invoice" })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(db.projects[0].phase).toBe(4));
    expect(db.projects[0]).toMatchObject({ nextStep: "Follow up on the proposal", waitingOn: "client" });
    expect(db.projects[0].phaseDates[5]).toBeUndefined();
  });

  test("the Move projects forward setting turns it off", async () => {
    const db = installFakeApi({ projects: [project()], settings: { autoMove: false } });
    logIn();
    const user = userEvent.setup();
    renderAt({ pathname: "/docs/new/proposal", state: { projectId: "p1" } });
    await user.selectOptions(await screen.findByLabelText("Status"), "Sent");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(db.docs).toHaveLength(1));
    expect(db.projects[0].phase).toBe(3);
  });

  test("a saved content checklist updates the project's Content tab", async () => {
    const db = installFakeApi({ projects: [project({ phase: 8 })], settings: { autoMove: false } });
    logIn();
    const user = userEvent.setup();
    renderAt({ pathname: "/docs/new/content", state: { projectId: "p1" } });
    await screen.findByText(/Items/);
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(db.docs).toHaveLength(1));
    await waitFor(() => expect(db.projects[0].content?.length).toBeGreaterThan(5));
    expect(db.projects[0].content[0]).toMatchObject({ label: expect.any(String), done: false });
  });
});

describe("the Docs home and the project", () => {
  const invoice = { id: "i1", type: "invoice", number: "INV-2026-001", status: "Sent", projectId: "p1", client: "Christ Life Church", total: 100, date: "2026-01-02", createdAt: "2026-01-02T00:00:00Z", updatedAt: "2026-01-02T00:00:00Z", data: { date: "2026-01-02", dueDays: 7, contactName: "Joe", kind: "deposit" } };

  test("shows what is owed, filters, and opens a document", async () => {
    installFakeApi({ projects: [project()], docs: [invoice, { ...invoice, id: "pr1", type: "proposal", number: "PRO-2026-001", status: "Accepted", data: { org: "Christ Life Church", pages: [], goals: [], features: [], items: [], sections: {}, date: "2026-01-02" } }] });
    logIn();
    const user = userEvent.setup();
    renderAt("/docs");
    expect(await screen.findByText(/still owed on 1 invoice/)).toBeInTheDocument();
    expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Proposals" }));
    expect(screen.queryByText("INV-2026-001")).not.toBeInTheDocument();
    expect(screen.getByText("PRO-2026-001")).toBeInTheDocument();
    await user.click(screen.getByText("PRO-2026-001"));
    expect(await screen.findByRole("heading", { name: /PRO-2026-001/ })).toBeInTheDocument();
  });

  test("Today lists unpaid invoices with a reminder button, and the card shows badges", async () => {
    installFakeApi({ projects: [project()], docs: [invoice] });
    logIn();
    renderAt("/today");
    expect(await screen.findByText("Money & replies")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy payment reminder" })).toBeInTheDocument();
    expect(screen.getByText(/INV-2026-001 · \$100\.00 unpaid/)).toBeInTheDocument();
  });

  test("the project's Docs tab lists its documents and has a create button for every type", async () => {
    installFakeApi({ projects: [project()], docs: [invoice] });
    logIn();
    const user = userEvent.setup();
    renderAt("/projects");
    expect(await screen.findByText("$100 overdue")).toBeInTheDocument(); // badge on the card (the invoice is long past due)
    await user.click(screen.getByRole("heading", { name: "Christ Life" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("tab", { name: "Docs" }));
    expect(within(dialog).getByText("INV-2026-001")).toBeInTheDocument();
    for (const n of ["Proposal", "Agreement", "Invoice", "Receipt", "Content checklist", "Timeline", "Revision log", "Handover", "Testimonial request"]) {
      expect(within(dialog).getByRole("button", { name: `+ ${n}` })).toBeInTheDocument();
    }
  });
});
