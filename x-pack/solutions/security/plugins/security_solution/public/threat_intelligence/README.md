# Threat Intelligence

Elastic Threat Intelligence makes it easy to analyze and investigate potential security threats by aggregating data from multiple sources in one place. You’ll be able to view data from all activated threat intelligence feeds and take action.

## Development setup

### Kibana development in general

Best source - [internal Kibana docs](https://docs.elastic.dev/kibana-dev-docs/getting-started/welcome). If you have any issues with setting up your Kibana dev environment [#kibana](https://elastic.slack.com/archives/C0D8P2XK5) Slack channel is a good way to get help.

### Essential `kibana.yml` settings

You can make a copy of `kibana.yml` file into `kibana.dev.yml` and make adjustments to the settings. External documentation on the flags available is [here](https://www.elastic.co/guide/en/kibana/current/settings.html)

It is recommended to set `server.basePath: "/kbn"` to make you local instance persist the base Kibana path. If you don't do it, the base path will be a random string every time you start Kibana. Any other value than `/kbn` will also work.

### Getting Threat Intelligence feeds data into Kibana

There are many ways to get data for you local development. We first focus on getting Threat Intelligence data specifically.

### Setting up filebeat threatintel integrations locally

1. install [mage](https://github.com/magefile/mage). It is a Go build tool used to build `beats`. Installation from the sources requires Go lang set up. A simpler option might be to install it from a package manager available in your system (eg. `brew` on MacOs) or use their [binary distribution](https://github.com/magefile/mage/releases)
1. start Elasticsearch and Kibana
1. clone [beats](https://github.com/elastic/beats) repository
1. inside beats repository, update `x-pack/filebeat/filebeat.yml` with your local Elasticsearch and Kibana connection configs

   ```
   output.elasticsearch:
   hosts: ["localhost:9200"]
   username: "elastic"
   password: "changeme"

   setup.kibana:
   host: "localhost:5601" // make sure to run Kibana with --no-base-path option or specify server.basePath in Kibana config and use it here as a path, eg. localhost:5601/kbn
   ```

1. go into `x-pack/filebeat` (that's where security related modules live)
1. build filebeat `mage build`
1. enable `threatintel` module by running `./filebeat modules enable threatintel`
1. enable specific Threat Intelligence integrations by updating `modules.d/threatintel.yml`. Update `enable` to `true` in every integration you want to enable and configs specific for these integrations. The bare minimum is to enable Abuse.CH feeds `abuseurl`, `abusemalware` and `malwarebazaar`.
1. run `./filebeat setup -E setup.dashboards.directory=build/kibana` to set up predefined dashboards
1. run `./filebeat -e` to start filebeat
1. to validate that the set up works, wait for some Threat Intel data to be ingested and then go in Analytics > Discover in your local Kibana to search `event.category : threat and event.type : indicator`. You should see some documents returned by this search. Abuse.CH feeds are up to date so you should see the results from the last 7 days.

### More ways to get data

There are many more tools available for getting the data for testing or local development, depending on the data type and usecase.

- Kibana development docs > [Add data](https://docs.elastic.dev/kibana-dev-docs/getting-started/sample-data)
- [Dev/Design/Testing Environments and Frameworks](https://docs.google.com/document/d/1DGCcLMnVKQ_STlkbS4E0m4kbPivNtR8iMlg_IoCuCEw/edit#) gathered by Security Engineering Productivity team

### Generate fixtures for local testing

You can generate large volumes of threat indicators on demand with the following script:

```
node scripts/generate_indicators.js
```

see the file in order to adjust the amount of indicators generated. The default is one million.
