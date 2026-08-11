// Shared across every level (space/orbit/node metadata, note metadata) per plan.md decision #6:
// "Same shape, same rendering path at every level." Read-only — a note's own metadata bag
// (e.g. the CIDR/VLAN example in plan.md) isn't editable through the UI, only via seed data.
export function MetadataTable({ metadata }: { metadata: Record<string, string | number> }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return null;

  return (
    <table className="text-sm">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <td className="text-muted-foreground py-0.5 pr-3 font-mono capitalize">{key}</td>
            <td className="py-0.5 break-words">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
