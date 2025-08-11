type Props = { error: Error };
export default function ErrorFallback({ error }: Props) {
  console.error(error);
  return (
    <div className="mx-auto max-w-2xl p-8">
      <h2 className="text-xl font-bold">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <a href="/" className="mt-4 inline-block rounded bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800">
        Reload
      </a>
    </div>
  );
}