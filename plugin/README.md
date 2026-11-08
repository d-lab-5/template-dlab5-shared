# dlab5-shared-docs

The shared-docs template's own agent skill: a product's public `<product>-shared` repository and how it reaches docs.dlab5.net. This folder is outside the Copier `template/` subdirectory, so product repositories don't copy it.

**Install** from the D-LAB-5 catalogue:

```
/plugin marketplace add d-lab-5/agent-skills
/plugin install dlab5-shared-docs@d-lab-5
```

**Change a skill** here, in its one home. Then bump `version` in
`.claude-plugin/plugin.json`, or installed copies never see the change. Try a
working copy with `claude --plugin-dir plugin`. Never copy this skill into
another repository: point to it instead.
