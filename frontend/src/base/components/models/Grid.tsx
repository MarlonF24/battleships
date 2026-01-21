import styled from "styled-components";

export const StyledGrid = styled.table.attrs({className: "grid"})({
	
  borderCollapse: "collapse",
  borderSpacing: 0,
  boxSizing: "border-box",
  background: "#e3f2fd",
  border: "2px solid #1976d2",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",


  ".cell": {
    width: "var(--cell-size)",
    height: "var(--cell-size)",

    textAlign: "center",
    verticalAlign: "middle",
    border: "1px solid #444",
    boxSizing: "border-box",
    padding: 0,
  }
})

export const Grid = ({rows, cols}: {rows: number, cols: number}) => {
	return (
			<StyledGrid>
				<tbody>
					{Array.from({ length: rows }, (_, r) => (
						<tr key={r}>
							{Array.from({ length: cols }, (_, c) => (
								<td key={`${r}-${c}`} className="cell" />
							))}
						</tr>
					))}
				</tbody>
			</StyledGrid>
	);
}
