/** Route-local legacy error view that retries the exact failed location. */

import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button, ErrorMessage } from "../components/ui";

/** Keep route failures local and offer retry of the exact failed URL. */
export function RouteErrorPage() {
  const routeError = useRouteError();
  const message = isRouteErrorResponse(routeError)
    ? routeError.statusText || "This page could not be displayed."
    : routeError instanceof Error
      ? routeError.message
      : "An unexpected error has occurred.";

  return (
    <AppShell>
      <section className="flex min-h-52 flex-col items-center justify-center gap-4 text-center text-xl">
        <h1 className="text-danger text-2xl font-bold">Oops!</h1>
        <p>Sorry, an unexpected error has occurred.</p>
        <ErrorMessage message={message} />
        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="danger" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Link
            to="/"
            className="bg-primary hover:bg-primary-hover inline-flex min-h-10 items-center justify-center rounded-sm px-4 py-2 text-base font-bold text-white"
          >
            Back to Home
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
