import Node from "./Node.js"
import Edge from "./Edge.js"
import Route from "./Route.js"
import Map from "ol/Map"
import OSM from "ol/source/OSM"
import VectoreSource from "ol/source/Vector"
import VectorLayer from "ol/layer/Vector"
import View from "ol/View"
import TileLayer from "ol/layer/Tile"
import Draw from "ol/interaction/Draw"
import { fromLonLat, toLonLat, transformExtent } from "ol/proj"
import { defaults, ZoomSlider } from "ol/control"
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import 'ol/ol.css'
import p5 from "p5"

const vectorSource = new VectoreSource({
    wrapX: false,
  })
  const vector = new VectorLayer({
    source: vectorSource,
  })
  var openlayersmap = new Map({
    //OpenLayers https://openlayers.org
    target: "OSMmap",
    layers: [
      new TileLayer({
        source: new OSM(),
        opacity: 0.5,
      }),
      vector,
    ],
    view: new View({
      center: fromLonLat([5.95, 47.26]),
      zoom: 12,
    }),
    controls: defaults().extend([new ZoomSlider()]),
  })
  
  var canvas
  var mapHeight
  var mapWidth
  var windowX, windowY
  var headerHeight
  var polygonPadding = 40
  let txtoverpassQuery
  var OSMxml
  var numnodes, numways
  var nodes
  var minlat = Infinity,
    maxlat = -Infinity,
    minlon = Infinity,
    maxlon = -Infinity
  var nodes = [],
    edges = []
export var mapminlat = Infinity,
    mapmaxlat = -Infinity,
    mapminlon = Infinity,
    mapmaxlon = -Infinity
  var totaledgedistance = 0
  var closestnodetomouse = -1
  var closestedgetomouse = -1
  var startnode, currentnode
  var selectnodemode = 2,
    solveRESmode = 4,
    choosemapmode = 1,
    trimmode = 3,
    downloadGPXmode = 5
  var mode
  var remainingedges
  var debugsteps = 0
  var bestdistance
  var currentroute
  export var bestroute
  var bestarea
  var bestdoublingsup
  export var showSteps = false
  var showRoads = true
  var iterations, iterationsperframe
  var actionButton = document.querySelector("#action-button")
  var margin
  var starttime
  var efficiencyhistory = [],
    distancehistory = []
  var totalefficiencygains = 0
  var isTouchScreenDevice = false
  var totaluniqueroads
  var olDraw
  var olDrawCoordinates
  var polygon
export var polygonminX = Infinity,
    polygonmaxX = -Infinity,
    polygonminY = Infinity,
    polygonmaxY = -Infinity
  var settings = {
    category: "walk", //walk = no oneway ; car = oneway ; bicycle = oneway:bicycle
    oneway: false,
  }
  var stack = []
  var stack2 = []

function init() {
      if (navigator.geolocation) {
        //if browser shares user GPS location, update map to center on it.
        navigator.geolocation.getCurrentPosition(function (position) {
          openlayersmap
            .getView()
            .setCenter(
              fromLonLat([position.coords.longitude, position.coords.latitude])
            )
        })
      }
      headerHeight = document.getElementById("header").clientHeight
      actionButton.addEventListener("click", actionButtonClicked)
      switch (settings.category) {
        case "walk":
          settings.oneway = false
          break
        case "car":
        case "bicycle":
          settings.oneway = true
          break
    
        default:
          break
      }
      mode = choosemapmode
      olDraw = new Draw({
        source: vectorSource,
        type: "Polygon",
      })
      olDraw.on("drawend", function (event) {
        openlayersmap.removeInteraction(olDraw)
        polygon = event.feature.getGeometry()
        olDrawCoordinates = polygon.getCoordinates()[0]
        updateActionButton("Validate the polygon", false, false)
      })
      openlayersmap.addInteraction(olDraw)
      updateActionButton("Create a polygon, then click here", true, false)
}

export let myp5 = new p5((sk) => {
    sk.setup = () => {
      console.log("setup")
      mapWidth = sk.windowWidth
      mapHeight = sk.windowHeight - headerHeight
      windowX = sk.windowWidth
      windowY = mapHeight
      canvas = sk.createCanvas(windowX, windowY)
      canvas.mousePressed(canvasClicked)
      sk.colorMode(sk.HSB)
      iterationsperframe = 1
      margin = 0.1 // don't pull data in the extreme edges of the map
    }
    
    sk.draw = () => {
      //main loop called by the P5.js framework every frame
      if (sk.touches.length > 0) {
        isTouchScreenDevice = true
      } // detect touch screen device such as mobile
      sk.clear()
      if (mode != choosemapmode) {
        if (showRoads) {
          showEdges() //draw connections between nodes
        }
        if (mode == solveRESmode) {
          iterationsperframe = myp5.max(0.01, iterationsperframe - 1 * (5 - myp5.frameRate())) // dynamically adapt iterations per frame to hit 5fps
          for (let it = 0; it < iterationsperframe; it++) {
            iterations++
            let solutionfound = false
            while (!solutionfound) {
              //run randomly down least roads until all roads have been run
              myp5.shuffle(currentnode.reachableEdges, true) //P5js function
              currentnode.reachableEdges.sort((a, b) => a.travels - b.travels) // sort edges around node by number of times traveled, and travel down least.
              let edgewithleasttravels = currentnode.reachableEdges[0]
              let nextNode = edgewithleasttravels.OtherNodeofEdge(currentnode)
              edgewithleasttravels.travels++
              currentroute.addWaypoint(nextNode, edgewithleasttravels.distance)
              currentnode = nextNode
              if (edgewithleasttravels.travels == 1) {
                // then first time traveled on this edge
                remainingedges-- //fewer edges that have not been travelled
              }
              if (remainingedges == 0) {
                //once all edges have been traveled, the route is complete. Work out total distance and see if this route is the best so far.
                solutionfound = true
                currentroute.distance += calcdistance(
                  currentnode.lat,
                  currentnode.lon,
                  startnode.lat,
                  startnode.lon
                )
                if (currentroute.distance < bestdistance) {
                  // this latest route is now record
                  bestroute = new Route(null, currentroute)
                  bestdistance = currentroute.distance
                  if (efficiencyhistory.length > 1) {
                    totalefficiencygains +=
                      totaledgedistance / bestroute.distance -
                      efficiencyhistory[efficiencyhistory.length - 1]
                  }
                  efficiencyhistory.push(totaledgedistance / bestroute.distance)
                  distancehistory.push(bestroute.distance)
                }
                currentnode = startnode
                remainingedges = edges.length
                currentroute = new Route(currentnode, null)
                resetEdges()
              }
            }
          }
        }
        showNodes()
        if (bestroute != null) {
          bestroute.show()
        }
        if (mode == solveRESmode) {
          drawProgressGraph()
        }
        if (mode == downloadGPXmode) {
          showReportOut()
        }
        //showStatus();
      }
    }
  })



function getOverpassData() {
  //load nodes and edge map data in XML format from OpenStreetMap via the Overpass API
  canvas.position(0, headerHeight) // start canvas just below logo image
  bestroute = null
  totaluniqueroads = 0
  var LonLat = ""
  for (let i = 1; i < olDrawCoordinates.length; i++) {
    //skip the first coordinates (duplicated in the last)
    const coord = toLonLat(olDrawCoordinates[i])
    if (i > 1) {
      LonLat += " "
    }
    mapminlat = myp5.min(coord[1], mapminlat)
    mapmaxlat = myp5.max(coord[1], mapmaxlat)
    mapminlon = myp5.min(coord[0], mapminlon)
    mapmaxlon = myp5.max(coord[0], mapmaxlon)

    const pixelCoordinate = openlayersmap.getPixelFromCoordinate(
      olDrawCoordinates[i]
    ) //X = long = -1.... | Y = lat = 47....
    polygonminX = myp5.min(pixelCoordinate[0], polygonminX)
    polygonmaxX = myp5.max(pixelCoordinate[0], polygonmaxX)
    polygonminY = myp5.min(pixelCoordinate[1], polygonminY)
    polygonmaxY = myp5.max(pixelCoordinate[1], polygonmaxY)

    LonLat = LonLat + coord[1] + " " + coord[0]
  }

  let OverpassURL = "https://overpass-api.de/api/interpreter?data="
  let overpassquery =
    '(way(poly:"{{bbox}}"){{filter}};node(w)(poly:"{{bbox}}"););out;'
  let filter =
    "['highway']['highway' !~ 'trunk']['highway' !~ 'motorway']['highway' !~ 'motorway_link']['highway' !~ 'raceway']['highway' !~ 'proposed']['highway' !~ 'construction']['highway' !~ 'service']['highway' !~ 'elevator']['footway' !~ 'crossing']['footway' !~ 'sidewalk']['foot' !~ 'no']['access' !~ 'private']['access' !~ 'no']"

  overpassquery = overpassquery.replace("{{bbox}}", LonLat)
  overpassquery = overpassquery.replace("{{bbox}}", LonLat)
  overpassquery = overpassquery.replace("{{filter}}", filter)
  OverpassURL = OverpassURL + encodeURI(overpassquery)
  myp5.httpGet(OverpassURL, "text", false, function (response) {
    let OverpassResponse = response
    var parser = new DOMParser()
    OSMxml = parser.parseFromString(OverpassResponse, "text/xml")
    var XMLnodes = OSMxml.getElementsByTagName("node")
    var XMLways = OSMxml.getElementsByTagName("way")
    numnodes = XMLnodes.length
    numways = XMLways.length
    for (let i = 0; i < numnodes; i++) {
      var lat = XMLnodes[i].getAttribute("lat")
      var lon = XMLnodes[i].getAttribute("lon")
      minlat = myp5.min(minlat, lat)
      maxlat = myp5.max(maxlat, lat)
      minlon = myp5.min(minlon, lon)
      maxlon = myp5.max(maxlon, lon)
    }
    nodes = []
    edges = []
    for (let i = 0; i < numnodes; i++) {
      var lat = XMLnodes[i].getAttribute("lat")
      var lon = XMLnodes[i].getAttribute("lon")
      var nodeid = XMLnodes[i].getAttribute("id")
      let node = new Node(nodeid, lat, lon)
      nodes.push(node)
    }
    //parse ways into edges
    for (let i = 0; i < numways; i++) {
      let wayid = XMLways[i].getAttribute("id")

      // check if oneway for the settings
      let oneway = false
      if (settings.oneway) {
        let onewayTag = null
        let onewayBicycleTag = null
        let tagsinsideway = XMLways[i].getElementsByTagName("tag")
        for (const tag of tagsinsideway) {
          var tagValue = tag.getAttribute("k")
          if (tagValue == "oneway") {
            onewayTag = tag.getAttribute("v") == "yes"
          }
          if (tagValue == "oneway:bicycle") {
            onewayBicycleTag = tag.getAttribute("v") == "yes"
          }
          if (tagValue == "junction" && tag.getAttribute("v") == "roundabout") {
            onewayTag = true
          }
        }
        if (settings.category == "car" && onewayTag != null) {
          oneway = onewayTag
        }
        if (settings.category == "bicycle" && onewayTag) {
          oneway = !(onewayBicycleTag == false)
        }
      }

      let nodesinsideway = XMLways[i].getElementsByTagName("nd")
      for (let j = 0; j < nodesinsideway.length - 1; j++) {
        let fromnode = getNodebyId(nodesinsideway[j].getAttribute("ref"))
        let tonode = getNodebyId(nodesinsideway[j + 1].getAttribute("ref"))
        if ((fromnode != null) & (tonode != null)) {
          let newEdge = new Edge(fromnode, tonode, wayid, oneway)
          edges.push(newEdge)
          totaledgedistance += newEdge.distance
        }
      }
    }
    mode = selectnodemode
    updateActionButton("Click on start of route", true, false)
  })
}

function showNodes() {
  let closestnodetomousedist = Infinity
  for (let i = 0; i < nodes.length; i++) {
    if (showRoads) {
      nodes[i].show()
    }
    if (mode == selectnodemode) {
      let disttoMouse = myp5.dist(nodes[i].x, nodes[i].y, myp5.mouseX, myp5.mouseY)
      if (disttoMouse < closestnodetomousedist) {
        closestnodetomousedist = disttoMouse
        closestnodetomouse = i
      }
    }
  }
  if (mode == selectnodemode) {
    startnode = nodes[closestnodetomouse]
  }
  if (startnode != null && (!isTouchScreenDevice || mode != selectnodemode)) {
    startnode.highlight()
  }
}

function showEdges() {
  let closestedgetomousedist = Infinity
  for (let i = 0; i < edges.length; i++) {
    edges[i].show()
    if (mode == trimmode) {
      let dist = edges[i].distanceToPoint(myp5.mouseX, myp5.mouseY)
      if (dist < closestedgetomousedist) {
        closestedgetomousedist = dist
        closestedgetomouse = i
      }
    }
  }
  if (closestedgetomouse >= 0 && !isTouchScreenDevice) {
    edges[closestedgetomouse].highlight()
  }
}

function resetEdges() {
  for (const edge of edges) {
    edge.travels = 0
    edge.visited = false
  }
}

/**
 * remove unreachable nodes and edges
 */
function removeOrphans() {
  resetEdges()
  currentnode = startnode
  stack = []
  stack2 = []
  floodfill(currentnode, 1)
  let newedges = []
  let newnodes = []
  totaledgedistance = 0
  for (const edge of edges) {
    if (edge.travels > 0) {
      newedges.push(edge)
      totaledgedistance += edge.distance
      if (!newnodes.includes(edge.from)) {
        newnodes.push(edge.from)
      }
      if (!newnodes.includes(edge.to)) {
        newnodes.push(edge.to)
      }
    } else {
      deleteElementFromArray(edge, edge.from.edges)
      deleteElementFromArray(edge, edge.to.edges)
      if (settings.oneway) {
        deleteElementFromArray(edge, edge.from.reachableEdges)
        deleteElementFromArray(edge, edge.to.reachableEdges)
      } else {
        edge.from.reachableEdges = edge.from.edges
        edge.to.reachableEdges = edge.to.edges
      }
    }
  }
  edges = newedges
  nodes = newnodes
  resetEdges()
}

/**
 * recursively walk every unwalked route until all connected nodes have been reached at least once
 * @param {Node} node node to explore from
 * @param {Number} stepssofar how deep we are in the graph
 */
function floodfill(node, stepssofar) {
  for (const reachableEdge of node.reachableEdges) {
    if (
      settings.oneway &&
      ((node == currentnode && stepssofar > 1) ||
        (reachableEdge.visited &&
          reachableEdge.travels > 0 &&
          stack.length > 0 &&
          !(stack.includes(reachableEdge) || stack2.includes(reachableEdge))))
    ) {
      //clean the stacks if it's not a dead end
      stack = [] //to save the explored edges when we go down in the recusion (in the graph)
      stack2 = [] //to save the explored edges when we go up in the recusion (in the graph)
    }
    if (!reachableEdge.visited) {
      reachableEdge.travels = stepssofar
      reachableEdge.visited = true
      if (settings.oneway && (reachableEdge.oneway || stack.length > 0)) {
        //we save the edge if it is one way (and potentially a dead end) |OR| if we already are in a dead end
        stack.push(reachableEdge)
      }
      floodfill(reachableEdge.OtherNodeofEdge(node), stepssofar + 1) //let's go deaper in the graph
      if (settings.oneway && stack.length + stack2.length > 0) {
        //if the stacks are not empty, we didn't find an exit for the dead end yet...
        if (
          !reachableEdge.travels > 0 ||
          stack.includes(reachableEdge) ||
          stack2.includes(reachableEdge)
        ) {
          if (!stack2.includes(reachableEdge)) {
            stack2.push(reachableEdge) //...so we save the edge in the stack2. Waiting for a confirmation (dead end or not)
          }
          if (stack.includes(reachableEdge)) {
            deleteElementFromArray(reachableEdge, stack)
            if (reachableEdge.oneway) {
              //if the last edge is a oneway, it was a dead end and we'll be able to remove all the edges deaper
              for (const edge of stack2) {
                edge.travels = 0
              }
              stack2 = []
            }
          }
        }
      }
    }
  }
}

function solveRES() {
  removeOrphans()
  showRoads = false
  remainingedges = edges.length
  currentroute = new Route(currentnode, null)
  bestroute = new Route(currentnode, null)
  bestdistance = Infinity
  iterations = 0
  iterationsperframe = 1
  starttime = myp5.millis()
}

function actionButtonClicked() {
  if (mode == choosemapmode) {
    // Was in Choose map mode and clicked on button
    updateActionButton("Loading map data…", true, true)
    openlayersmap.getView().fit(polygon, {
      padding: [
        polygonPadding,
        polygonPadding,
        polygonPadding + headerHeight,
        polygonPadding,
      ],
      duration: 1000,
      callback: getOverpassData,
    })
    return
  }
  if (mode == trimmode) {
    mode = solveRESmode
    updateActionButton("Calculating… Click to stop when satisfied", false, true)
    showNodes() // recalculate closest node
    solveRES()
    return
  }
  if (mode == solveRESmode) {
    // Was busy solving and user clicked on button
    mode = downloadGPXmode
    updateActionButton("Download route (.gpx)", false, false)
    //calculate total unique roads (ways):
    let uniqueways = []
    for (let i = 0; i < edges.length; i++) {
      if (!uniqueways.includes(edges[i].wayid)) {
        uniqueways.push(edges[i].wayid)
      }
    }
    totaluniqueroads = uniqueways.length
    return
  }
  if (mode == downloadGPXmode) {
    // Clicked Download Route
    bestroute.exportGPX()
    return
  }
}

function canvasClicked() {
  // clicked on map to select a node
  if (mode == selectnodemode) {
    // Select node mode, and clicked on map
    showNodes() //find node closest to mouse
    mode = trimmode
    updateActionButton("Click on roads to trim, then click here")
    removeOrphans() // deletes parts of the network that cannot be reached from start
    return
  }
  if (mode == trimmode) {
    showEdges() // find closest edge
    // clicked on edge to remove it
    trimSelectedEdge()
  }
}

export function calcdistance(lat1, long1, lat2, long2) {
  lat1 = myp5.radians(lat1)
  long1 = myp5.radians(long1)
  lat2 = myp5.radians(lat2)
  long2 = myp5.radians(long2)
  return (
    2 *
    myp5.asin(
        myp5.sqrt(
            myp5.pow(myp5.sin((lat2 - lat1) / 2), 2) +
            myp5.cos(lat1) * myp5.cos(lat2) * myp5.pow(myp5.sin((long2 - long1) / 2), 2)
      )
    ) *
    6371.0
  )
}

function getNodebyId(id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].nodeId == id) {
      return nodes[i]
    }
  }
  return null
}

/**
 * Update the action button
 * @param {String}  msg       message to display
 * @param {Boolean} disabled  if button enabled or disabled
 * @param {Boolean} spinner   spinner enabled
 */
function updateActionButton(msg, disabled, spinner) {
  actionButton.querySelectorAll("span")[1].innerHTML = msg
  actionButton.disabled = disabled
  if (spinner) {
    actionButton.querySelectorAll("span")[0].classList.remove("d-none")
  } else {
    actionButton.querySelectorAll("span")[0].classList.add("d-none")
  }
}

/**
 * Remove a element from the array
 *
 * @param {Object} elementToDelete object to delete from the array
 * @param {Array} array array where the element will be removed
 */
function deleteElementFromArray(elementToDelete, array) {
  if (array.includes(elementToDelete)) {
    array.splice(
      array.findIndex((element) => element == elementToDelete),
      1
    )
  }
}

function trimSelectedEdge() {
  if (closestedgetomouse >= 0) {
    let edgetodelete = edges[closestedgetomouse]
    deleteElementFromArray(edgetodelete, edges)
    for (const node of nodes) {
      deleteElementFromArray(edgetodelete, node.edges)
      deleteElementFromArray(edgetodelete, node.reachableEdges)
    }
    removeOrphans() // deletes parts of the network that no longer can be reached.
    closestedgetomouse = -1
  }
}

function drawProgressGraph() {
  if (efficiencyhistory.length > 0) {
    myp5.noStroke()
    myp5.fill(0, 0, 0, 0.3)
    let graphHeight = 100
    myp5.rect(0, myp5.height - graphHeight, myp5.windowWidth, graphHeight)
    myp5.fill(0, 5, 225, 255)
    myp5.textAlign(myp5.LEFT)
    myp5.textSize(12)
    myp5.text(
      "Routes tried: " +
        iterations.toLocaleString() +
        ", Length of all roads: " +
        myp5.nf(totaledgedistance, 0, 1) +
        "km, Best route: " +
        myp5.nf(bestroute.distance, 0, 1) +
        "km (" +
        myp5.round(efficiencyhistory[efficiencyhistory.length - 1] * 100) +
        "%)",
      15,
      myp5.height - graphHeight + 18
    )
    myp5.textAlign(myp5.CENTER)
    myp5.textSize(12)
    for (let i = 0; i < efficiencyhistory.length; i++) {
      myp5.fill((i * 128) / efficiencyhistory.length, 255, 205, 1)
      let startx = myp5.map(i, 0, efficiencyhistory.length, 0, myp5.windowWidth)
      let starty = myp5.height - graphHeight * efficiencyhistory[i]
      myp5.rect(
        startx,
        starty,
        myp5.windowWidth / efficiencyhistory.length,
        graphHeight * efficiencyhistory[i]
      )
      myp5.fill(0, 5, 0)
      myp5.text(
        myp5.round(distancehistory[i]) + "km",
        startx + myp5.windowWidth / efficiencyhistory.length / 2,
        myp5.height - 5
      )
    }
  }
}

function showReportOut() {
  myp5.fill(250, 255, 0, 0.6)
  myp5.noStroke()
  myp5.rect(myp5.width / 2 - 150, myp5.height / 2 - 250, 300, 450)
  myp5.fill(250, 255, 0, 0.15)
  myp5.rect(myp5.width / 2 - 147, myp5.height / 2 - 247, 300, 450)
  myp5.strokeWeight(1)
  myp5.stroke(20, 255, 255, 0.8)
  myp5.line(myp5.width / 2 - 150, myp5.height / 2 - 200, myp5.width / 2 + 150, myp5.height / 2 - 200)
  myp5.noStroke()
  myp5.fill(0, 0, 255, 1)
  myp5.textSize(28)
  myp5.textAlign(myp5.CENTER)
  myp5.text("Route Summary", myp5.width / 2, myp5.height / 2 - 215)
  myp5.fill(0, 0, 255, 0.75)
  myp5.textSize(16)
  myp5.text("Total roads covered", myp5.width / 2, myp5.height / 2 - 170 + 0 * 95)
  myp5.text("Total length of all roads", myp5.width / 2, myp5.height / 2 - 170 + 1 * 95)
  myp5.text("Length of final route", myp5.width / 2, myp5.height / 2 - 170 + 2 * 95)
  myp5.text("Efficiency", myp5.width / 2, myp5.height / 2 - 170 + 3 * 95)

  myp5.textSize(36)
  myp5.fill(20, 255, 255, 1)
  myp5.text(totaluniqueroads, myp5.width / 2, myp5.height / 2 - 120 + 0 * 95)
  myp5.text(myp5.nf(totaledgedistance, 0, 1) + "km", myp5.width / 2, myp5.height / 2 - 120 + 1 * 95)
  myp5.text(
    myp5.nf(bestroute.distance, 0, 1) + "km",
    myp5.width / 2,
    myp5.height / 2 - 120 + 2 * 95
  )
  myp5.text(
    myp5.round((100 * totaledgedistance) / bestroute.distance) + "%",
    myp5.width / 2,
    myp5.height / 2 - 120 + 3 * 95
  )
}

function showStatus() {
  if (startnode != null) {
    let textx = 2
    let texty = mapHeight - 400
    myp5.fill(0, 5, 225)
    myp5.noStroke()
    myp5.textSize(12)
    myp5.textAlign(myp5.LEFT)
    myp5.text("Total number nodes: " + nodes.length, textx, texty)
    myp5.text("Total number road sections: " + edges.length, textx, texty + 20)
    myp5.text(
      "Length of roads: " + myp5.nf(totaledgedistance, 0, 3) + "km",
      textx,
      texty + 40
    )
    if (bestroute != null) {
      if (bestroute.waypoints.length > 0) {
        myp5.text(
          "Best route: " +
            nf(bestroute.distance, 0, 3) +
            "km, " +
            nf((100 * totaledgedistance) / bestroute.distance, 0, 2) +
            "%",
          textx,
          texty + 60
        )
      }
      myp5.text("Routes tried: " + iterations, textx, texty + 80)
      myp5.text("Frame rate: " + myp5.frameRate(), textx, texty + 100)
      myp5.text("Solutions per frame: " + iterationsperframe, textx, texty + 120)
      myp5.text(
        "Iterations/second: " + (iterations / (myp5.millis() - starttime)) * 1000,
        textx,
        texty + 140
      )
      myp5.text("best routes: " + efficiencyhistory.length, textx, texty + 160)
      myp5.text(
        "efficiency gains: " +
          myp5.nf(100 * totalefficiencygains, 0, 2) +
          "% and " +
          myp5.nf(
            ((100 * totalefficiencygains) / (myp5.millis() - starttime)) * 1000,
            0,
            2
          ) +
          "% gains/sec:",
        textx,
        texty + 180
      ) //
      myp5.text("isTouchScreenDevice: " + isTouchScreenDevice, textx, texty + 200)
    }
  }
}

init()