# Device UI Motion review gate

At 60 fps, the default shot boundaries are frames 0, 220, 536, 698 and 910.

- **0–3.67 s, compose:** formation settles before the glyph becomes dominant;
  moving the camera must not cancel the control entrance.
- **3.67–8.93 s, navbar:** the selected icon and capsule share one beat; selection
  is not circular. Change the selected slot and ensure both move together.
- **8.93–11.63 s, search:** the compact navbar and search control remain separated,
  on the same screen plane, with glyphs above glass rather than blurred into it.
- **11.63–15.17 s, end:** copy and background match the supplied brand; no reference
  product, sample organization, or unintended logo remains.

Kill criteria: UI sliding off the display; independent phone/UI rotation; blurred
glyphs; missing media disguised as placeholder art; unlicensed model/footage;
frame-dependent results after seeking; a static grid used as sole motion evidence.

Check at production aspect ratio and with the actual supplied mesh. Compare a still
before and after out-of-order seeking. Verify positive/negative yaw, camera offset,
thicker glass, selected-slot changes and a scoped preview in saved composition.
The automated synthetic fixture is not a substitute for this final visual check.
