
# Data


## Properties

Name | Type
------------ | -------------
`numPlayersReady` | number
`selfReady` | boolean
`opponentConnected` | boolean
`row` | number
`col` | number
`hit` | boolean
`sunkLength` | [Ship](Ship.md)
`ships` | [Array&lt;Ship&gt;](Ship.md)
`ownShipGrid` | [View](View.md)
`opponentShipGrid` | [View](View.md)

## Example

```typescript
import type { Data } from ''

// TODO: Update the object below with actual values
const example = {
  "numPlayersReady": null,
  "selfReady": null,
  "opponentConnected": null,
  "row": null,
  "col": null,
  "hit": null,
  "sunkLength": null,
  "ships": null,
  "ownShipGrid": null,
  "opponentShipGrid": null,
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


