import { describe, test, expect } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import { installFakeApi } from "./fakeApi.js";

const renderApp = (path = "/") => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
const logIn = () => localStorage.setItem("phq_token", "tok");
const paidProject = (over = {}) => ({ id: "a1", name: "Christ Life", client: "Christ Life Church", contactName: "Joe", type: "Website", billing: "paid", status: "active", phase: 8, phaseDates: { 8: "2026-01-02" },
  nextStep: "Send the content checklist", waitingOn: "me", scope: [], payments: [], content: [], depositPct: 10, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", ...over });
const sheet = () => within(screen.getByRole("dialog"));

describe("login", () => {
  test("shows the app name, a clear error for a wrong password, then logs in", async () => {
    installFakeApi({ projects: [paidProject()] });
    const user = userEvent.setup();
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "Parteh HQ" })).toBeInTheDocument();
    expect(screen.getByText("The Professor's Study")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "me@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password.");
    expect(localStorage.getItem("phq_token")).toBeNull();

    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Your next moves")).toBeInTheDocument();
    expect(localStorage.getItem("phq_token")).toBe("tok");
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  test("an expired token logs you out", async () => {
    installFakeApi();
    localStorage.setItem("phq_token", "old-token");
    renderApp("/today");
    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(localStorage.getItem("phq_token")).toBeNull();
    expect(await screen.findByText(/login has expired/i)).toBeInTheDocument();
  });

  test("log out clears the token", async () => {
    installFakeApi();
    logIn();
    const user = userEvent.setup();
    renderApp("/today");
    await user.click(await screen.findByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(localStorage.getItem("phq_token")).toBeNull();
  });
});

describe("projects", () => {
  test("create, edit and delete a project", async () => {
    const db = installFakeApi();
    logIn();
    const user = userEvent.setup();
    renderApp("/projects");
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();

    // create
    await user.click(screen.getByRole("button", { name: "+ New project" }));
    await user.click(sheet().getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Give the project a name first")).toBeInTheDocument(); // needs a name
    await user.type(sheet().getByLabelText("Project name"), "Grace Chapel site");
    await user.type(sheet().getByLabelText("Organization / client"), "Grace Chapel");
    await user.click(sheet().getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Grace Chapel site" })).toBeInTheDocument();
    expect(db.projects).toHaveLength(1);
    expect(db.projects[0]).toMatchObject({ name: "Grace Chapel site", client: "Grace Chapel", phase: 0, billing: "paid" });

    // edit
    await user.click(screen.getByRole("heading", { name: "Grace Chapel site" }));
    const name = sheet().getByLabelText("Project name");
    await user.clear(name); await user.type(name, "Grace Chapel website");
    await user.click(sheet().getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Grace Chapel website" })).toBeInTheDocument();
    expect(db.projects[0].name).toBe("Grace Chapel website");

    // delete needs a second tap
    await user.click(screen.getByRole("heading", { name: "Grace Chapel website" }));
    await user.click(sheet().getByRole("button", { name: "Delete" }));
    expect(db.projects).toHaveLength(1);
    await user.click(sheet().getByRole("button", { name: "Tap again to delete" }));
    await waitFor(() => expect(db.projects).toHaveLength(0));
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
  });

  test("a failed save rolls back and shows an error", async () => {
    const db = installFakeApi({ projects: [paidProject()] });
    logIn();
    const user = userEvent.setup();
    renderApp("/projects");
    await user.click(await screen.findByRole("heading", { name: "Christ Life" }));
    const name = sheet().getByLabelText("Project name");
    await user.clear(name); await user.type(name, "Renamed");
    db.failNext = /^PUT \/api\/projects/;
    await user.click(sheet().getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Something went wrong on the server.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // stays open, nothing lost
    await user.click(sheet().getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: "Christ Life" })).toBeInTheDocument(); // rolled back
    expect(db.projects[0].name).toBe("Christ Life");
  });

  test("filters the list", async () => {
    installFakeApi({ projects: [paidProject(), paidProject({ id: "b2", name: "Early lead", phase: 1 })] });
    logIn();
    const user = userEvent.setup();
    renderApp("/projects");
    expect(await screen.findByRole("heading", { name: "Early lead" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Leads" }));
    expect(screen.getByRole("heading", { name: "Early lead" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Christ Life" })).not.toBeInTheDocument();
  });
});

describe("the sheet", () => {
  test("the deposit gate blocks work until a payment is logged", async () => {
    installFakeApi({ projects: [paidProject()] });
    logIn();
    const user = userEvent.setup();
    renderApp("/projects");
    await user.click(await screen.findByRole("heading", { name: "Christ Life" }));
    await user.click(sheet().getByRole("tab", { name: "Workflow" }));

    const dev = () => sheet().getByRole("button", { name: /Development/ });
    await user.click(dev());
    expect(await screen.findByText("Log the deposit in the Money tab before starting work")).toBeInTheDocument();
    expect(dev()).not.toHaveAttribute("aria-current");

    await user.click(sheet().getByRole("tab", { name: "Money" }));
    await user.click(sheet().getByRole("button", { name: "+ Log a payment" }));
    const amount = sheet().getByLabelText("Amount");
    await user.clear(amount); await user.type(amount, "50");
    await user.click(sheet().getByRole("tab", { name: "Workflow" }));
    await user.click(dev());
    expect(dev()).toHaveAttribute("aria-current", "step");
  });

  test("the next-step dropdown sets who the project is waiting on", async () => {
    installFakeApi({ projects: [paidProject()] });
    logIn();
    const user = userEvent.setup();
    renderApp("/projects");
    await user.click(await screen.findByRole("heading", { name: "Christ Life" }));
    const waiting = () => sheet().getByLabelText("Waiting on");
    expect(waiting()).toHaveValue("me");

    await user.selectOptions(sheet().getByLabelText("Next step"), "Wait for the deposit");
    expect(waiting()).toHaveValue("client");
    await user.selectOptions(sheet().getByLabelText("Next step"), "Design the UI");
    expect(waiting()).toHaveValue("me");

    await user.selectOptions(sheet().getByLabelText("Next step"), "__custom");
    const own = sheet().getByLabelText("Your own next step");
    await user.type(own, "Call the pastor");
    expect(own).toHaveValue("Call the pastor");
  });

  test("logging a payment shows the deposit and balance", async () => {
    installFakeApi({ projects: [paidProject({ scope: [{ item: "Website", price: 300 }] })] });
    logIn();
    const user = userEvent.setup();
    renderApp("/projects");
    await user.click(await screen.findByRole("heading", { name: "Christ Life" }));
    await user.click(sheet().getByRole("tab", { name: "Money" }));
    expect(sheet().getAllByText("$300").length).toBeGreaterThan(0);
    await user.click(sheet().getByRole("button", { name: "+ Log a payment" }));
    expect(sheet().getByLabelText("Amount")).toHaveValue(30); // the 10% deposit
    expect(sheet().getByText(/✓/)).toBeInTheDocument();
  });
});

describe("pricing page", () => {
  test("shows the suggested price, rush and discount, and the deposit", async () => {
    installFakeApi({ projects: [paidProject()] });
    logIn();
    const user = userEvent.setup();
    renderApp("/pricing");
    expect(await screen.findByTestId("quote-total")).toHaveTextContent("$215");
    await user.click(screen.getByLabelText("Rush job"));
    expect(screen.getByTestId("quote-total")).toHaveTextContent("$269");
    await user.click(screen.getByLabelText("Church / nonprofit discount"));
    expect(screen.getByTestId("quote-total")).toHaveTextContent("$229");
    expect(screen.getByTestId("quote-deposit")).toHaveTextContent("$23");
  });
});
