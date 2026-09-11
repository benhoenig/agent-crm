// The @modal slot renders nothing unless a route is being intercepted into
// it. Next needs this file to know what an unmatched slot looks like after a
// full page load; without it an unmatched slot 404s the whole page.
export default function Default() {
  return null;
}
