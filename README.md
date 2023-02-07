# jspacex
Manually (and semi-manually) control your rocket. Try to land it softly back onto the ground.

## Play instructions

- Clone repo and run the `index.html` file with your browser (tested with Brave and Edge). 
- Or run it directly online <https://raw.githack.com/olofer/jspacex/main/index.html>.

### Keyboard guide

- up/down arrows increase/decrease main engine massflow
- left/right arrows control side thrusters
- `R` reset
- `P` reset and cycle to next preprogrammed demo
- `M` switch to full manual mode at current state
- `A` toggle automatic angular velocity stabilization
- `B` set main throttle to balance gravity (for present mass)
- `L` toggle automatic landing burn
- `+` / `-` zoom view in and out

The game gives the above guide as text below the canvas as reminder.

### Scoring

If the rocket lands softly the base score given is the maximum elevation achieved. If the rocket crashes the base score given is zero. The absolute horizonal distance from the origin is subtracted from the base score to give the final score. The score unit is `meters`.

---

Remember that fuel is limited and good luck!
