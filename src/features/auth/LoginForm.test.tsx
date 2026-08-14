import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LoginForm } from "./LoginForm";

afterEach(cleanup);

describe("LoginForm", () => {
  it("valida y envía correo normalizado sin almacenar la contraseña", async () => {
    const login = jest.fn().mockResolvedValue({
      id: "17ab9958-a8d5-42bd-b511-96342b9f1cd8",
      displayName: "Laura Gómez",
      email: "laura@example.com",
      assignedRole: "user",
      status: "active",
      sessionExpiresAt: "2026-08-14T12:00:00Z",
    });
    render(<LoginForm onBack={jest.fn()} onRegister={jest.fn()} login={login} />);

    fireEvent.changeText(screen.getByLabelText("Correo electrónico"), " LAURA@EXAMPLE.COM ");
    fireEvent.changeText(screen.getByLabelText("Contraseña"), "ClaveSegura#2026");
    fireEvent.press(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: "laura@example.com",
        password: "ClaveSegura#2026",
      }),
    );
    expect(await screen.findByRole("header", { name: "Sesión iniciada" })).toBeTruthy();
  });

  it("muestra un error genérico de credenciales", async () => {
    const login = jest.fn().mockRejectedValue(new Error("Correo o contraseña incorrectos."));
    render(<LoginForm onBack={jest.fn()} onRegister={jest.fn()} login={login} />);

    fireEvent.changeText(screen.getByLabelText("Correo electrónico"), "nadie@example.com");
    fireEvent.changeText(screen.getByLabelText("Contraseña"), "incorrecta");
    fireEvent.press(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Correo o contraseña incorrectos.")).toBeTruthy();
  });

  it("entrega la cuenta autenticada para decidir la navegación por rol", async () => {
    const receipt = {
      id: "17ab9958-a8d5-42bd-b511-96342b9f1cd8",
      displayName: "Administrador CUSOL",
      email: "admin@cusol.local",
      assignedRole: "super_admin" as const,
      status: "active" as const,
      sessionExpiresAt: "2026-08-14T12:00:00Z",
    };
    const login = jest.fn().mockResolvedValue(receipt);
    const onAuthenticated = jest.fn();
    render(
      <LoginForm
        onBack={jest.fn()}
        onRegister={jest.fn()}
        onAuthenticated={onAuthenticated}
        login={login}
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText("Correo electrónico"),
      "admin@cusol.local",
    );
    fireEvent.changeText(
      screen.getByLabelText("Contraseña"),
      "una-clave-no-registrada-en-el-test",
    );
    fireEvent.press(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(receipt));
  });
});
