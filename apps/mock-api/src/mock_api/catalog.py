"""Les sites de l'API Mock de la formation, recopiés de sa réponse du 29 septembre 2026.

Les profils horaires sont les moyennes de consommation (kW) par heure UTC,
mesurées sur la semaine du 22 au 28 septembre 2026 (tests/fixtures), en
semaine puis le week-end. `noise_kw` est l'écart-type observé à midi en
semaine : il suffit à rendre la courbe crédible sans noyer le profil.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Site:
    site_id: str
    site_type: str
    site_name: str
    location: str
    capacity_kw: float
    status: str
    weekday_kw: tuple[float, ...]
    weekend_kw: tuple[float, ...]
    noise_kw: float

    def info(self) -> dict[str, object]:
        return {
            "site_id": self.site_id,
            "site_type": self.site_type,
            "site_name": self.site_name,
            "location": self.location,
            "capacity_kw": self.capacity_kw,
            "status": self.status,
        }


# Tableau de calibration, gardé une ligne par profil pour se relire contre la capture.
# fmt: off
SITES: tuple[Site, ...] = (
    Site(
        "SITE001", "office", "Bureau Paris La Défense", "Paris, France", 200.0, "active",
        (60, 62, 64, 63, 60, 62, 61, 62, 87, 128, 173, 177, 172, 161, 171, 173, 167, 169, 124, 61, 62, 61, 60, 59),
        (74, 80, 75, 74, 76, 74, 72, 75, 74, 74, 72, 75, 72, 72, 74, 70, 74, 73, 73, 71, 75, 74, 72, 70),
        6.9,
    ),
    Site(
        "SITE002", "factory", "Usine Lyon Vénissieux", "Lyon, France", 1000.0, "active",
        (269, 268, 274, 276, 265, 272, 405, 651, 934, 911, 918, 904, 907, 912, 907, 895, 891, 883, 929, 895, 902, 661, 281, 276),
        (351, 337, 334, 334, 352, 339, 330, 335, 320, 331, 352, 329, 347, 332, 336, 344, 327, 347, 331, 347, 340, 353, 326, 355),
        22.8,
    ),
    Site(
        "SITE003", "datacenter", "Data Center Marseille", "Marseille, France", 800.0, "active",
        (729, 754, 730, 743, 750, 769, 771, 730, 761, 769, 751, 722, 724, 720, 726, 715, 753, 708, 735, 694, 713, 714, 715, 718),
        (748, 738, 734, 770, 738, 748, 778, 740, 756, 762, 707, 744, 721, 747, 713, 699, 741, 717, 724, 670, 703, 689, 725, 742),
        49.4,
    ),
    Site(
        "SITE004", "retail", "Centre Commercial Lille", "Lille, France", 400.0, "active",
        (123, 126, 120, 127, 126, 120, 126, 124, 128, 164, 256, 341, 346, 334, 328, 338, 337, 335, 345, 339, 255, 122, 123, 126),
        (287, 284, 286, 290, 269, 298, 297, 288, 278, 279, 285, 309, 309, 273, 291, 281, 294, 298, 276, 305, 284, 276, 292, 292),
        22.9,
    ),
    Site(
        "SITE005", "hospital", "Hôpital Toulouse Purpan", "Toulouse, France", 600.0, "active",
        (485, 483, 481, 496, 475, 494, 507, 483, 483, 506, 481, 484, 464, 458, 462, 462, 457, 446, 441, 456, 465, 455, 462, 473),
        (497, 491, 500, 476, 500, 508, 511, 467, 486, 496, 516, 514, 451, 472, 494, 419, 455, 448, 457, 462, 453, 465, 461, 458),
        17.7,
    ),
    Site(
        "SITE006", "office", "Bureau Bordeaux Centre", "Bordeaux, France", 180.0, "active",
        (55, 55, 56, 56, 55, 55, 54, 56, 77, 108, 142, 142, 143, 148, 147, 142, 147, 147, 106, 56, 56, 55, 55, 55),
        (65, 67, 68, 62, 65, 63, 68, 64, 65, 71, 66, 64, 65, 68, 67, 66, 61, 63, 63, 65, 65, 68, 62, 63),
        4.6,
    ),
    Site(
        "SITE007", "factory", "Usine Nantes Rezé", "Nantes, France", 950.0, "active",
        (245, 237, 247, 255, 256, 244, 384, 586, 856, 870, 860, 828, 872, 863, 870, 835, 855, 845, 862, 853, 875, 633, 251, 256),
        (316, 304, 313, 299, 304, 318, 310, 303, 327, 317, 298, 313, 298, 318, 312, 314, 333, 305, 312, 318, 311, 300, 298, 316),
        26.6,
    ),
)
# fmt: on

SITES_BY_ID: dict[str, Site] = {site.site_id: site for site in SITES}
