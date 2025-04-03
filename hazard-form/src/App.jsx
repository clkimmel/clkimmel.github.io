import { useEffect, useRef, useState } from 'react'
import WebMap from '@arcgis/core/WebMap';
import Editor from '@arcgis/core/widgets/Editor';
import MapView from '@arcgis/core/views/MapView';
import Search from '@arcgis/core/widgets/Search';
import OAuthInfo from "@arcgis/core/identity/OAuthInfo";
import esriId from "@arcgis/core/identity/IdentityManager"

import "@esri/calcite-components/dist/components/calcite-notice";
import { CalciteNotice } from "@esri/calcite-components-react";


import './App.css'

function App() {
  const formDiv = useRef(null);
  const mapDiv = useRef(null);
  const searchDiv = useRef(null);
  const [error, setError] = useState("");
  const loaded = useRef(false);

  const initSearch = (layer) => {
    return new Search({
      container: searchDiv.current,
      includeDefaultSources: false,
      sources: [
        {  layer: layer,
          placeholder: "Search by workorder ID",
          maxResults: 5,
          searchFields: ["workorderid"],
          displayField: "workorderid"
        }
      ]
    });
  }
  const initEditor = (mapView) => {
    return new Editor({
      view: mapView,
      container: formDiv.current,
      allowedWorkflows: 'update',
      visibleElements: {
        createFeaturesSection: false,
        snappingControls: false,
        snappingControlsElements: {
          enabledToggle: false,
          featureEnabledToggle: false,
          header: false,
          layerList: false,
          selfEnabledToggle: false
        },
        editFeaturesSection: false
      },
      supportingWidgetDefaults: {
        featureForm: {
          groupDisplay: "all"
        }
      }
    });    
  }
  const setFeature = async (feature, editor) => {
    await editor.startUpdateWorkflowAtFeatureEdit(feature);    
    editor.container.setAttribute('hidden', '');     
    setTimeout(() => {
      const items = document.querySelectorAll('calcite-flow-item');
      items.forEach(item => item.shadowRoot.querySelector('calcite-panel').shadowRoot.querySelector('.header').setAttribute('hidden',''))
      document.querySelector('.esri-editor').setAttribute('style', 'visibility: visible')   
    },100);  
  }
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;

      const loadMap = async () => {
        const info = new OAuthInfo({
          portalUrl: 'https://indoors.raleighnc.gov/portal'',
          appId:'vUYon8zPqmDfCBI8',
          popup: false
        });
        esriId.registerOAuthInfos([info]);
        try {
          esriId.checkSignInStatus(info.portalUrl + '/sharing');
        } catch {
          esriId.getCredential(info.portalUrl + '/sharing');
        }
        const map = new WebMap({
          portalItem: {
            portal: 'https://indoors.raleighnc.gov/portal',
            id: '6f7dfb860ead4e72983006c11c83387e'//'6f7dfb860ead4e72983006c11c83387e'
          }
        });        

        const mapView = new MapView({
          map: map,
          container: mapDiv.current
        });        
        await mapView.when();
        const layer = map.layers.getItemAt(0);

        const editor = initEditor(mapView);

        const search = initSearch(layer);
        search.on('search-complete', e => {
          if (e.numResults > 0) {
            console.log(e.results[0].results[0]);
            setFeature(e.results[0].results[0].feature, editor);    
            setError('');
          }
        });        
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        const results = await layer.queryFeatures({where: `workorderid = '${id}'`, outFields: ['*']});
        if (results.features.length) {
          const feature = results.features[0];
          setFeature(feature, editor);
          setError('');
        } else {
          setError(`No workorder with an ID of ${id} found, search for a workorder below.`)
        }
      }
      loadMap();
    }
  },[]);
  return (
    <>
      {<CalciteNotice open={error.length > 0 ? '' : undefined} closable kind="danger" icon="exclamation-mark-circle-f">
        <div slot="title">Workorder ID Not Found</div>
        <div slot="message">{error}</div>
      </CalciteNotice>}
      <div className='header'>
        <div ref={searchDiv}></div>
      </div>
      <div ref={formDiv}></div>
      <div ref={mapDiv}></div>

    </>
  )
}

export default App
