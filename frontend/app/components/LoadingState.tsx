export default function LoadingState({ message = "Loading..." }: { message?: string }) {
  return <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-4 px-5 py-8 text-center text-sm text-slate-600">
    <span aria-hidden="true" className="size-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600 motion-reduce:animate-none" />
    <p>{message}</p>
  </div>;
}
