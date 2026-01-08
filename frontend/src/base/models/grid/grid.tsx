import "./grid.css";



export class Grid  {
	constructor(readonly rows: number, readonly cols: number) {}
	
	public readonly Renderer = () => {

		return (<table className="grid">
			<tbody>
				{Array.from({ length: this.rows }, (_, r) => (
					<tr key={r}>
						{Array.from({ length: this.cols }, (_, c) => (
							<td key={`${r}-${c}`} className="cell" />
						))}
					</tr>
				))}
			</tbody>
		</table>
		);
	}
};
