import React, {Component} from 'react';
import './App.css';
import olGeometryCircle from 'ol/geom/circle';
import olGeometryPoint from 'ol/geom/point';
import olFeature from 'ol/feature';
import olLayerVector from 'ol/layer/vector';
import proj from 'ol/proj';
import olStyleIcon from 'ol/style/icon'
import olStyle from 'ol/style/style';
import olStyleStroke from 'ol/style/stroke';
import olSourceVector from 'ol/source/vector';
import distance from '@turf/distance';
import {Controls, Map, Popup, PopupBase, loadDataLayer, LayerPanel} from '@bayer/ol-kit'
import axios from 'axios';
import logo from './communibee.png'
import bee from './bee.png'

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      myMap: null,
      userId: '13c50af7-a97c-4a47-9d5a-22a36fe9b2d2',
      contextOpen: false,
      contextLocation: [],
      contextCoords: [],
      hives: [],
      hiveName: '',
      addingHive: false,
      reportingSwarm: false,
    }
  }

  getAllHives = map => {
    map.getLayers().getArray().forEach(layer => {
      if (layer.type === 'VECTOR') {
        map.removeLayer(layer)
      }
    });
    axios
      .get('https://communibee.herokuapp.com/hives', {
        headers: {
          'Authorization': '4c7a0b5d-13ee-49a3-9c5e-f691c49af963'
        }
      })
      .then(res => {
        this.setState({hives: res.data});
        const hiveLayer = new olLayerVector({
          title: 'Hives',
          source: new olSourceVector()
        });
        const hiveCoords = res.data.map(hive => {
          return {hiveId: hive.geojson.features[0].properties.hiveId, coords: hive.geojson.features[0].geometry.coordinates
          }});
        const robbingDanger = [];
        const sharedForage = [];
        hiveCoords.forEach(loc => {
          hiveCoords.forEach(loc2 => {
            const hiveDist = distance(loc.coords, loc2.coords, {units: 'miles'});
            if (hiveDist !== 0 && hiveDist < 4) {
              sharedForage.push(loc.hiveId);
            }
            if (hiveDist !== 0 && hiveDist < 2) {
              robbingDanger.push(loc.hiveId);
            }
          })
        });
        const hiveFeatures = res.data.map(hive => {
          const {name, hiveId}  = hive.geojson.features[0].properties;
          const hiveCoords = proj.transform(hive.geojson.features[0].geometry.coordinates, 'EPSG:4326', 'EPSG:3857');
          const hiveLocation = new olFeature({
            geometry: new olGeometryPoint(hiveCoords),
            name: name,
            hiveId: hiveId,
            diseases_or_pests: hive.issues,
            robbingDanger: robbingDanger.includes(hiveId),
            sharedForage: sharedForage.includes(hiveId),
          });
          hiveLocation.setStyle(new olStyle({
            image: new olStyleIcon({
              src: bee,
              scale: 0.05,
              anchor: [0.5, 1]
            })
          }));
          const foragingCircle = new olFeature({
            geometry: new olGeometryCircle(hiveCoords, 4100),
            name: 'Foraging Area',
            associatedHive: name,
            associatedHiveId: hiveId,
          });
          foragingCircle.setStyle(new olStyle({
            stroke: new olStyleStroke({
              color: 'black'
            })
          }));
          return [hiveLocation, foragingCircle]
        });
        hiveLayer.getSource().addFeatures(hiveFeatures.flat());
        map.addLayer(hiveLayer)
      });
  };

  addHive = () => {
    if (!this.state.hiveName) {
      alert('Hive name is required');
      return
    }
    this.hideContext();
    axios.post('https://communibee.herokuapp.com/addHive',
      {
        userId: this.state.userId,
        name: this.state.hiveName,
        lat: this.state.contextCoords[1],
        long: this.state.contextCoords[0],
      }, {headers: {
        'Authorization': '4c7a0b5d-13ee-49a3-9c5e-f691c49af963'
      }}).then(() => this.getAllHives(this.state.myMap));
    this.setState({hiveName: ''});
  };

  toggleAddingHive = () => {
    this.setState({addingHive: !this.state.addingHive})
  };

  toggleReportingSwarm = () => {
    this.setState({reportingSwarm: !this.state.reportingSwarm})
  };

  onMapInit = map => {
    this.setState({myMap: map});
    this.getAllHives(map);
    document.addEventListener('contextmenu', e => {
      e.preventDefault();
      const position = map.getCoordinateFromPixel([e.x, e.y]);
      const position4326 = proj.transform(position, 'EPSG:3857', 'EPSG:4326');
      this.setState({contextLocation: [e.x, e.y], contextCoords: position4326});
      this.showContext();
    });
    map.on('click', this.hideContext);
  };

  showContext = () => {
    this.setState({contextOpen: true, addingHive: false, reportingSwarm: false})
  };

  hideContext = () => {
    this.setState({contextOpen: false, addingHive: false, reportingSwarm: false})
  };

  handleHiveNameChange = (evt) => {
    this.setState({hiveName: evt.target.value});
  };

  contextButtons = () => {
    return (
      <div>
        <button onClick={() => this.toggleAddingHive()}>Add Hive</button>
        <button onClick={() => this.toggleReportingSwarm()}>Swarm Report</button>
      </div>
    )
  };

  render() {
    return (
      <div>
        <div style={{width: '100%', backgroundColor: 'black', display: 'flex', justifyContent: 'center'}}>
          <img src={logo} style={{height: 60}} alt={'CommuniBee'}/>
        </div>
        <Map onMapInit={this.onMapInit} >
          <LayerPanel />
          <Controls />
          <Popup />
          <PopupBase pixel={this.state.contextLocation} show={this.state.contextOpen} >
            <div>
              {this.state.addingHive || this.state.reportingSwarm ? null: this.contextButtons()}
              {this.state.addingHive ? (
                <div>
                  <label>
                    Hive Name:
                    <input type="text" value={this.state.hiveName} onChange={this.handleHiveNameChange}/>
                  </label>
                  <button onClick={() => this.addHive()}>Save</button>
                </div>
              ): null}
              {this.state.reportingSwarm ? (
                <div>
                  Swarm Report
                </div>
              ) : null}
            </div>
          </PopupBase>
        </Map>
      </div>
    );
  }
}

export default App;
