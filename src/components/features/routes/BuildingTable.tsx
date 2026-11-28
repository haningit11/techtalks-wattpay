type Building = { id: string; name: string; address: string; description: string | null };

export function BuildingTable({ buildings }: { buildings: Building[] }) {
  if (buildings.length === 0) {
    return <p className="wp-text-secondary">No buildings yet. Add the first one above.</p>;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th align="left">Name</th>
          <th align="left">Address</th>
          <th align="left">Description</th>
        </tr>
      </thead>
      <tbody>
        {buildings.map((building) => (
          <tr key={building.id}>
            <td>{building.name}</td>
            <td>{building.address}</td>
            <td className="wp-text-secondary">{building.description ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}