import Table from "../../blocks/table";
import { gameStore } from "../../game/store";

export default function GameMarketPanel() {
  const rows = () =>
    (gameStore.report().economy?.market ?? []).map((good) => [good.good, good.pack, good.sell, good.buy]);

  return (
    <Table
      hug
      columns={[
        { label: "Good" },
        { label: "Pack", align: "right" },
        { label: "Sell", align: "right" },
        { label: "Buy", align: "right" },
      ]}
      rows={rows()}
      empty="nothing on the market"
    />
  );
}
