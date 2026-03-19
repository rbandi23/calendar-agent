import { getPeopleClient } from "@/lib/google";
import type { Contact } from "@/types";

/**
 * Search contacts using the Google People API.
 * Returns matching contacts with name, email, and photo.
 */
export async function searchContacts(
  accessToken: string,
  query: string,
  pageSize = 10
): Promise<Contact[]> {
  const people = getPeopleClient(accessToken);

  const res = await people.people.searchContacts({
    query,
    pageSize,
    readMask: "names,emailAddresses,photos",
  });

  const results: Contact[] = [];

  for (const result of res.data.results ?? []) {
    const person = result.person;
    if (!person) continue;

    const name =
      person.names?.[0]?.displayName ?? person.emailAddresses?.[0]?.value ?? "";
    const email = person.emailAddresses?.[0]?.value ?? "";
    const photoUrl = person.photos?.[0]?.url ?? undefined;
    const resourceName = person.resourceName ?? "";

    if (email) {
      results.push({ resourceName, name, email, photoUrl });
    }
  }

  return results;
}
