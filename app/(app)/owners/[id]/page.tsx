import { redirect } from "next/navigation";

// Old owner detail links. NOT redirected to /contacts/[id]: the merge (0015)
// inserted owners as new contact rows, so every former owner id is dead —
// forwarding the id would just 404. The relationships survived (listings and
// owner_links were repointed); only these URLs did not, so they land on the
// book, which is searchable.
export default function OwnerDetailRedirect() {
  redirect("/contacts");
}
