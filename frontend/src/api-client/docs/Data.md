
# Data


## Properties

Name | Type
------------ | -------------
`ships` | [Array&lt;Ship&gt;](Ship.md)
`opponentConnected` | boolean
`initiallyConnected` | boolean
`ownShipGrid` | [View](View.md)
`opponentShipGrid` | [View](View.md)
`row` | number
`col` | number
`numPlayersReady` | number
`selfReady` | boolean
`hit` | boolean
`sunkShip` | [Ship](Ship.md)

## Example

```typescript
import type { Data } from ''

// TODO: Update the object below with actual values
const example = {
  "ships": null,
  "opponentConnected": null,
  "initiallyConnected": null,
  "ownShipGrid": null,
  "opponentShipGrid": null,
  "row": null,
  "col": null,
  "numPlayersReady": null,
  "selfReady": null,
  "hit": null,
  "sunkShip": null,
} satisfies Data

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Data
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


