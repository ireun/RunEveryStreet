import { myp5, calcdistance } from "./main"

export default class Edge {
  wayid
  from
  to
  travels
  distance
  oneway
  visited

  /**
   * section of road that connects nodes
   *
   * @param {Node}    from_
   * @param {Node}    to_
   * @param {Number}  wayid_ OSM ID
   * @param {boolean} oneway
   */
  constructor(from_, to_, wayid_, oneway) {
    this.wayid = wayid_
    this.from = from_
    this.to = to_
    this.oneway = oneway
    this.travels = 0
    this.distance = calcdistance(
      this.from.lat,
      this.from.lon,
      this.to.lat,
      this.to.lon
    )
    if (!this.from.edges.includes(this)) {
      this.from.edges.push(this)
      this.from.reachableEdges.push(this)
    }
    if (!this.to.edges.includes(this)) {
      this.to.edges.push(this)
      if (!this.oneway) {
        this.to.reachableEdges.push(this)
      }
    }
  }

  show() {
    myp5.strokeWeight(myp5.min(10, (this.travels + 1) * 2))
    myp5.stroke(55, 255, 255, 0.8)
    myp5.line(this.from.x, this.from.y, this.to.x, this.to.y)
    myp5.fill(0)
    myp5.noStroke()
    if (this.oneway) {
      myp5.push()
      var angle = myp5.atan2(this.from.y - this.to.y, this.from.x - this.to.x)
      myp5.translate(this.to.x, this.to.y)
      myp5.rotate(angle - myp5.HALF_PI)
      var offset = 7
      myp5.triangle(0, offset, offset * 0.5, offset, 0, -offset / 2)
      myp5.pop()
    }
  }

  highlight() {
    myp5.strokeWeight(4)
    myp5.stroke(20, 255, 255, 1)
    myp5.line(this.from.x, this.from.y, this.to.x, this.to.y)
    myp5.fill(0)
    myp5.noStroke()
  }

  OtherNodeofEdge(node) {
    if (node == this.from) {
      return this.to
    } else {
      return this.from
    }
  }

  /**
   * Replaces the oldNode with the newNode for this edge
   *
   * @param {Node} oldNode old node to replace
   * @param {Node} newNode new node for si edge
   */
  replaceNode(oldNode, newNode) {
    if (this.to == oldNode) {
      this.to = newNode
    } else {
      this.from = newNode
    }
  }

  /**
   * Gives distance from middle of this edge to give point
   * 
   * @param {Number} x x coordinates of the point
   * @param {Number} y y coordinates of the point
   * @returns 
   */
  distanceToPoint(x, y) {
    return myp5.dist(
      x,
      y,
      (this.to.x + this.from.x) / 2,
      (this.to.y + this.from.y) / 2
    )
  }
}
