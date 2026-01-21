
# PregameParams


## Properties

Name | Type
------------ | -------------
`battleGridRows` | number
`battleGridCols` | number
`shipLengths` | { [key: string]: number; }
`mode` | [GameMode](GameMode.md)

## Example

```typescript
import type { PregameParams } from ''

// TODO: Update the object below with actual values
const example = {
  "battleGridRows": null,
  "battleGridCols": null,
  "shipLengths": null,
  "mode": null,
} satisfies PregameParams

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PregameParams
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


