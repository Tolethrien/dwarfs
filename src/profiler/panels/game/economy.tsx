import Table from "../../blocks/table";
import { Block, Rows } from "../../grid/layout";
import { gameStore } from "../../game/store";

export default function GameEconomyPanel() {
  const rows = () => (gameStore.report().resources ?? []).map((resource) => [resource.name, resource.amount]);

  return (
    <Rows>
      <Block size="fit">
        <span class="text-body">{gameStore.report().date ?? "—"}</span>
      </Block>
      <Block size="fill">
        <Table
          columns={[
            { label: "Resource", width: "minmax(6rem,1fr)" },
            { label: "Amount", width: "auto", align: "right" },
          ]}
          rows={rows()}
          empty="no resources"
        />
      </Block>
    </Rows>
  );
}
