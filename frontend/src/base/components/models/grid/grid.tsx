import "./grid.css";



export const Grid = ({rows, cols}: {rows: number, cols: number}) => {
	return (
			<table className="grid">
				<tbody>
					{Array.from({ length: rows }, (_, r) => (
						<tr key={r}>
							{Array.from({ length: cols }, (_, c) => (
								<td key={`${r}-${c}`} className="cell" />
							))}
						</tr>
					))}
				</tbody>
			</table>
	);
}
