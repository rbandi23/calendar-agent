import "@testing-library/jest-dom";

// Mock next-auth
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: {
      user: {
        name: "Test User",
        email: "test@example.com",
        image: null,
      },
    },
    status: "authenticated",
  })),
  signOut: jest.fn(),
  signIn: jest.fn(),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  usePathname: jest.fn(() => "/dashboard"),
}));

// Mock fetch globally
global.fetch = jest.fn();
