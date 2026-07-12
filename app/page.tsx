import CandleConfigurator from "@/components/candle-configurator/CandleConfigurator";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-6xl flex-1 flex-col items-center gap-8 px-8 py-16">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Votre Bougie
          </h1>
        </header>
        <CandleConfigurator />
      </main>
    </div>
  );
}
