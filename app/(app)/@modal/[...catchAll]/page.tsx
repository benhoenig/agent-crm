// CLOSES THE MODAL ON THE WAY OUT, and it has to exist.
//
// A parallel slot keeps whatever it last rendered across client-side
// navigation — so after createListing() redirects to /listings/<id>, the
// modal would still be sitting there over the detail page. Next's own answer
// (parallel-routes docs, "Closing the modal") is to give the slot a route
// that matches everything else and renders nothing. `default.tsx` does not
// cover this: it is only consulted after a full page load.
export default function CatchAll() {
  return null;
}
