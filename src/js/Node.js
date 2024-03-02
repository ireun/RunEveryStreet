import { myp5, mapmaxlat, mapminlat, mapmaxlon, mapminlon, polygonmaxX, polygonminX, polygonmaxY, polygonminY } from "./main"

export default class Node {
  nodeId
  lat
  lon
  pos
  x
  y
  edges = []
  reachableEdges = []

  /**
   *
   * @constructor
   * @param {number} nodeId_ Node ID
   * @param {number} lat_    Latitude
   * @param {number} lon_    Longitude
   */
  constructor(nodeId_, lat_, lon_) {
    this.nodeId = nodeId_
    this.lat = lat_
    this.lon = lon_
    this.pos = myp5.createVector(1, 1)
    this.x = myp5.map(this.lon, mapminlon, mapmaxlon, polygonminX, polygonmaxX)
    this.y = myp5.map(this.lat, mapminlat, mapmaxlat, polygonmaxY, polygonminY)
  }

  show() {
    myp5.noStroke()
    myp5.colorMode(myp5.HSB)
    myp5.fill(0, 255, 255, 100)
    myp5.ellipse(this.x, this.y, 2)
  }

  highlight() {
    myp5.noStroke()
    myp5.colorMode(myp5.HSB)
    myp5.fill(0, 255, 255, 0.5)
    myp5.ellipse(this.x, this.y, 15)
  }
}
