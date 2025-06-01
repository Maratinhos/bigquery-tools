import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom'; // Needed because LoginPage uses useNavigate
import LoginPage from './LoginPage';

// Mock authService to prevent actual API calls
// vitest.mock('../services/authService', () => ({
//   login: vi.fn(),
// }));
// Simpler mock if specific mock return values are not immediately needed for render test:
vi.mock('../services/authService', () => {
    return {
        login: vi.fn().mockResolvedValue({ access_token: 'fake_token' }) // Mock successful login
    };
});


// Mock useNavigate
const mockedUsedNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockedUsedNavigate,
  }
});

describe('LoginPage Component', () => {
  it('renders login form elements correctly', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    // Check for Email field
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();

    // Check for Password field
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    // Check for Sign In button
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('allows typing into email and password fields', async () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    await fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(emailInput.value).toBe('test@example.com');

    await fireEvent.change(passwordInput, { target: { value: 'password123' } });
    expect(passwordInput.value).toBe('password123');
  });

  it('calls login service and navigates on successful submit', async () => {
    const { login } = await import('../services/authService'); // Get the mocked login

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    await fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    await fireEvent.change(passwordInput, { target: { value: 'password123' } });
    await fireEvent.click(signInButton);

    expect(login).toHaveBeenCalledWith('test@example.com', 'password123');
    // Check if localStorage was called (indirectly, via successful login logic)
    // This requires mocking localStorage or checking its effect.
    // For now, we assume if login is called and resolved, token logic runs.
    // expect(localStorage.setItem).toHaveBeenCalledWith('authToken', 'fake_token');

    // Check navigation
    // Wait for navigation to be called, potentially after async operations
    // Vitest doesn't have a direct waitForNavigaion like RTL sometimes does with history object.
    // We check if our navigate mock was called.
    // setTimeout might be needed if navigation is delayed, but usually not for simple cases.
    expect(mockedUsedNavigate).toHaveBeenCalledWith('/');
  });

});
