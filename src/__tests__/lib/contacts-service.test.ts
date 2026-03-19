import { searchContacts } from "@/lib/contacts-service";

jest.mock("@/lib/google", () => ({
  getPeopleClient: jest.fn(() => ({
    people: {
      searchContacts: jest.fn().mockResolvedValue({
        data: {
          results: [
            {
              person: {
                resourceName: "people/1",
                names: [{ displayName: "Alice Smith" }],
                emailAddresses: [{ value: "alice@test.com" }],
                photos: [{ url: "https://example.com/alice.jpg" }],
              },
            },
            {
              person: {
                resourceName: "people/2",
                names: [{ displayName: "Bob Jones" }],
                emailAddresses: [{ value: "bob@test.com" }],
                photos: [],
              },
            },
            {
              person: {
                resourceName: "people/3",
                names: [],
                emailAddresses: [],
                photos: [],
              },
            },
          ],
        },
      }),
    },
  })),
}));

describe("contacts-service", () => {
  const token = "test-token";

  describe("searchContacts", () => {
    it("returns contacts with name and email", async () => {
      const contacts = await searchContacts(token, "alice");
      expect(contacts).toHaveLength(2); // Third one has no email, filtered out
      expect(contacts[0].name).toBe("Alice Smith");
      expect(contacts[0].email).toBe("alice@test.com");
      expect(contacts[0].photoUrl).toBe("https://example.com/alice.jpg");
      expect(contacts[1].name).toBe("Bob Jones");
    });
  });
});
