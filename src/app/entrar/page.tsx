import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginOtp } from "@/components/LoginOtp";

export const metadata: Metadata = {
  title: "Entrar — padel",
};

export default function PaginaEntrar() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-fundo px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-3xl font-extrabold text-tinta">
          Entrar no app
        </h1>
        <p className="mt-2 text-center text-sm text-tinta-suave">
          Você recebe um código no seu WhatsApp — sem senha para decorar.
        </p>
        <div className="mt-8">
          <Suspense>
            <LoginOtp />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
