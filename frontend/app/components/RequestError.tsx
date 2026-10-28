"use client";
export default function RequestError({ message, retry, title = "Unable to load this page" }: { message: string; retry: () => void; title?: string }) {
  return <div role="alert" className="mx-auto my-6 w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
    <h1 className="text-lg font-bold">{title}</h1><p className="mt-2 break-words">{message}</p>
    <button type="button" onClick={retry} className="mt-4 min-h-11 rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold hover:bg-red-100">Try again</button>
  </div>;
}
