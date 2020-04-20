import React, {Component} from 'react';
import './App.css';
import olGeometryCircle from 'ol/geom/circle';
import olFeature from 'ol/feature';
import olLayerVector from 'ol/layer/vector';
import proj from 'ol/proj';
import olStyleIcon from 'ol/style/icon'
import olStyle from 'ol/style/style';
import olStyleStroke from 'ol/style/stroke';
import olSourceVector from 'ol/source/vector';
import {Controls, Map, Popup, PopupBase, loadDataLayer, LayerPanel, PopupActionGroup, PopupActionItem} from '@bayer/ol-kit'
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
    }
  }

  getAllHives = map => {
    axios
      .get('https://communibee.herokuapp.com/hives', {
        headers: {
          'Authorization': '4c7a0b5d-13ee-49a3-9c5e-f691c49af963'
        }
      })
      .then(res => {
        this.setState({hives: res.data});
        // const hiveLayer = new olLayerVector({
        //   name: 'Hives',
        //   source: new olSourceVector()
        // });
        res.data.forEach(hive => {
          loadDataLayer(map, hive.geojson).then(layer => {
            const foragingCircle = new olFeature({
              geometry: new olGeometryCircle(layer.getSource().getFeatures()[0].getGeometry().getCoordinates(), 3219),
              name: 'Foraging Area',
              associatedHive: layer.getSource().getFeatures()[0].getProperties().name,
              associatedHiveId: layer.getSource().getFeatures()[0].getProperties().hiveId
            });
            foragingCircle.setStyle(new olStyle({
              stroke: new olStyleStroke({
                color: 'black'
              })
            }));
            layer.getSource().getFeatures()[0].setStyle(new olStyle({
              image: new olStyleIcon({
                src: bee,
                scale: 0.05,
              })
            }));
            layer.getSource().addFeature(foragingCircle);
          })
        })
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
      }}).then(() => this.getAllHives(this.state.myMap))
  };

  toggleAddingHive = () => {
    this.setState({addingHive: !this.state.addingHive})
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
    this.setState({contextOpen: true, addingHive: false})
  };

  hideContext = () => {
    this.setState({contextOpen: false, addingHive: false})
  };

  handleHiveNameChange = (evt) => {
    this.setState({hiveName: evt.target.value});
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
              {this.state.addingHive ? (
                <div>
                  <label>
                    Hive Name:
                    <input type="text" value={this.state.hiveName} onChange={this.handleHiveNameChange}/>
                  </label>
                  <button onClick={() => this.addHive()}>Save</button>
                </div>
                ): <button onClick={() => this.toggleAddingHive()}>Add Hive</button>}
            </div>
          </PopupBase>
        </Map>
      </div>
    );
  }
}

export default App;
